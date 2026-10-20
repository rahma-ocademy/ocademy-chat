import { describe, expect, it } from "vitest";
import { buildOrderOnlineImport } from "@/lib/orderonline/import";
import { mapOrderOnlinePayload } from "@/lib/orderonline/webhook";

// Fixture mengikuti contoh respons di dokumentasi OrderOnline Open API (nilai disederhanakan).
const autotext = {
  welcome: { enabled: true, format: "Bank transfer General", format_cod: "COD General", format_instant: "E-Payment General", schedule: { type: "immediately", day: 0, hour: 0 } },
  follow_up_1: { enabled: true, format: "Halo {{name}}, bayar di {{e_payment_link}}", schedule: { type: "fixed", day: 1, hour: 11 } },
  follow_up_2: { enabled: true, format: "Halo {{name}}, {{product_name}} {{e_payment_link}}", format_cod: "COD {{name}}", schedule: { type: "fixed", day: 2, hour: 12 } },
  processing: { enabled: true, format: "Terima kasih {{name}}, {{total_price}}", schedule: { type: "immediately", day: 0, hour: 0 } },
};
const shipping = {
  manifested: { enabled: true, format: "Resi {{receipt_number}} via {{shipping_courier}} untuk {{name}}" },
  delivery: { enabled: true, format: "Paket {{product_name}} sampai, total {{total_price}}" },
};

describe("buildOrderOnlineImport", () => {
  const out = buildOrderOnlineImport(autotext, shipping);
  const tpl = (k: string) => out.templates.find((t) => t.external_ref === k)!;
  const rule = (k: string) => out.rules.find((r) => r.external_ref === k)!;

  it("mengimpor semua template dengan variabel internal", () => {
    expect(out.templates).toHaveLength(6);
    expect(tpl("follow_up_1").body).toBe("Halo {{customer_name}}, bayar di {{payment_link}}");
    expect(tpl("follow_up_1").variables.sort()).toEqual(["customer_name", "payment_link"]);
    expect(tpl("manifested").variables.sort()).toEqual(["courier", "customer_name", "tracking_number"]);
  });
  it("menyimpan varian COD dan menandai preset", () => {
    expect(tpl("follow_up_2").variants.cod).toBe("COD {{customer_name}}");
    expect(tpl("welcome").preset).toBe(true);
    expect(tpl("follow_up_1").preset).toBe(false);
  });
  it("menerjemahkan jadwal tetap menjadi hari + jam", () => {
    expect(rule("follow_up_1")).toMatchObject({ delay_minutes: 1440, at_hour: 11, trigger_event: "order.created" });
    expect(rule("follow_up_2")).toMatchObject({ delay_minutes: 2880, at_hour: 12 });
    expect(rule("welcome")).toMatchObject({ delay_minutes: 0, at_hour: undefined });
  });
  it("follow-up bayar berhenti saat dibayar/dibatalkan; pengiriman memakai event shipping", () => {
    expect(rule("follow_up_1").stop_events).toEqual(["order.paid", "order.cancelled"]);
    expect(rule("processing")).toMatchObject({ trigger_event: "order.paid", stop_events: [] });
    expect(rule("manifested").trigger_event).toBe("shipping.manifested");
  });
  it("mengabaikan entri bukan objek", () => {
    expect(buildOrderOnlineImport({ x: null as never }, {}).templates).toHaveLength(0);
  });
});

describe("mapOrderOnlinePayload (asumsi format; lihat catatan di webhook.ts)", () => {
  const order = {
    order_id: 123456789,
    status: "pending",
    product_name: "Kelas A",
    gross_revenue: 149000,
    customer_data: { name: "Rani", phone: "081234567890" },
    payment: { method: "cod", status: "unpaid" },
    updated_at: "2026-10-20 10:00:00",
  };
  it("memetakan status ke event dan mengambil kontak", () => {
    const m = mapOrderOnlinePayload({ data: order })!;
    expect(m.type).toBe("order.created");
    expect(m.contact).toEqual({ phone: "081234567890", name: "Rani" });
    expect(m.data).toMatchObject({ order_id: "123456789", total: "149000", payment_method: "cod", customer_name: "Rani" });
    expect(m.idempotencyKey).toBe("oo:order.created:123456789:2026-10-20 10:00:00");
  });
  it("event eksplisit mengalahkan status", () => {
    expect(mapOrderOnlinePayload({ event: "Order.Paid", data: order })!.type).toBe("order.paid");
  });
  it("payload tanpa petunjuk event → null", () => {
    expect(mapOrderOnlinePayload({ foo: 1 })).toBeNull();
    expect(mapOrderOnlinePayload("x")).toBeNull();
  });
});
