import { describe, expect, it } from "vitest";
import { buildOrderOnlineImport, type OrderOnlineProduct } from "@/lib/orderonline/import";
import { mapOrderOnlinePayload } from "@/lib/orderonline/webhook";
import { matchesConditions } from "@/lib/followups/conditions";

// Fixture mengikuti bentuk `follow_up_autotext` di GET /v1/products (nilai disederhanakan).
const fu1 = { enabled: true, format: "Halo {{name}}, bayar di {{e_payment_link}}", schedule: { type: "fixed", day: 1, hour: 16 } };
const products: OrderOnlineProduct[] = [
  {
    _id: "p1",
    name: "Shampo",
    follow_up_autotext: {
      welcome: { enabled: true, format: "Selamat datang {{name}}, total {{total_price}}", schedule: { type: "immediately", day: 0, hour: 0 } },
      follow_up_1: fu1,
      cancelled: { enabled: false, format: "Dibatalkan", schedule: { type: "immediately" } },
    },
  },
  { _id: "p2", name: "Sabun", follow_up_autotext: { follow_up_1: fu1 } },
  { _id: "p3", name: "Kaos", follow_up_autotext: { follow_up_1: { ...fu1, format: "Kaos {{product_name}} siap kirim, {{name}}" } } },
  { _id: "p4", name: "Topi", follow_up_autotext: { follow_up_1: { ...fu1, schedule: { type: "fixed", day: 2, hour: 12 } } } },
];

describe("buildOrderOnlineImport (per produk)", () => {
  const out = buildOrderOnlineImport(products);
  const tpls = (key: string) => out.templates.filter((t) => t.external_ref.startsWith(`${key}:`));
  const rules = (key: string) => out.rules.filter((r) => r.external_ref.startsWith(`${key}:`));

  it("menggabungkan teks yang identik di banyak produk dan melewati entri nonaktif", () => {
    expect(tpls("follow_up_1")).toHaveLength(2);
    expect(tpls("welcome")).toHaveLength(1);
    expect(tpls("cancelled")).toHaveLength(0);
    expect(tpls("welcome")[0]).toMatchObject({ name: "Sambutan order", body: "Selamat datang {{customer_name}}, total {{total}}" });
  });
  it("memberi label produk pada nama template hanya bila ada beberapa versi teks", () => {
    expect(tpls("follow_up_1").map((t) => t.name).sort()).toEqual(["Follow-up bayar 1 · Kaos", "Follow-up bayar 1 · Shampo +2 produk"]);
  });
  it("aturan per (template + jadwal), dibatasi ke produknya", () => {
    expect(rules("follow_up_1")).toHaveLength(3);
    const shared = rules("follow_up_1").find((r) => r.name === "Follow-up bayar 1 · Shampo +1 produk")!;
    expect(shared).toMatchObject({ delay_minutes: 1440, at_hour: 16, stop_events: ["order.paid", "order.cancelled"] });
    expect(shared.conditions).toEqual([{ field: "product_ids", op: "in", values: ["p1", "p2"] }]);
    expect(shared.template_ref).toBe(rules("follow_up_1").find((r) => r.name.endsWith("Topi"))!.template_ref);
  });
  it("external_ref stabil dan diawali kunci progres OrderOnline", () => {
    expect(buildOrderOnlineImport(products).rules.map((r) => r.external_ref)).toEqual(out.rules.map((r) => r.external_ref));
    expect(out.rules.every((r) => /^[a-z_0-9]+:[0-9a-f]{10}:[0-9a-f]{10}$/.test(r.external_ref))).toBe(true);
  });
  it("aturan yang mencakup semua produk diberi label \"semua produk\"", () => {
    const two = buildOrderOnlineImport(products.slice(0, 2)).rules.find((r) => r.external_ref.startsWith("follow_up_1:"))!;
    expect(two.name).toBe("Follow-up bayar 1 · semua produk");
  });
  it("produk tanpa follow-up atau entri bukan objek diabaikan", () => {
    expect(buildOrderOnlineImport([{ _id: "x", name: "X" }, { _id: "y", name: "Y", follow_up_autotext: { a: null as never } }]).templates).toHaveLength(0);
  });
});

describe("mapOrderOnlinePayload (format resmi webhook)", () => {
  const order = {
    user_id: "u1",
    product_id: "5b5542469f05aa28a00e1712",
    order_id: 281343516,
    product_data: { name: "Test" },
    customer_data: { name: "Rani", phone: "+628080080808", address: "Jl. Test", city_name: "Kota Bandung", subdistrict_name: "Andir" },
    product_price: 10000,
    shipping: { courier: "jne", cost: 12000 },
    total_price: 22000,
    payment: { method: "bank_transfer", status: "unpaid" },
    status: "pending",
    updated_at: "2026-09-15 02:31:33",
    created_at: "2026-09-15 02:31:33",
  };

  it("checkout form: action create → order.created dengan data untuk template & kondisi", () => {
    const m = mapOrderOnlinePayload({ type: "order", action: "create", payload: order })!;
    expect(m.type).toBe("order.created");
    expect(m.idempotencyKey).toBe("oo:order.created:281343516");
    expect(m.contact).toEqual({ phone: "+628080080808", name: "Rani" });
    expect(m.data).toMatchObject({
      order_id: "281343516",
      product_ids: ["5b5542469f05aa28a00e1712"],
      product_name: "Test",
      total: "22000",
      shipping_cost: "12000",
      payment_method: "bank_transfer",
      city: "Kota Bandung",
      district: "Andir",
    });
    expect(matchesConditions([{ field: "product_ids", op: "in", values: ["5b5542469f05aa28a00e1712"] }], m.data)).toBe(true);
    expect(matchesConditions([{ field: "product_ids", op: "in", values: ["lain"] }], m.data)).toBe(false);
  });
  it("update: status processing → order.paid, kunci idempotensi memakai updated_at", () => {
    const m = mapOrderOnlinePayload({ type: "order", action: "update", payload: { ...order, status: "processing", updated_at: "2026-09-16 10:00:00" } })!;
    expect(m.type).toBe("order.paid");
    expect(m.idempotencyKey).toBe("oo:order.paid:281343516:2026-09-16 10:00:00");
    expect(mapOrderOnlinePayload({ type: "order", action: "update", payload: { ...order, updated_at: "2026-09-16" } })!.type).toBe("order.updated");
  });
  it("storefront: tanpa pembungkus, Extended JSON, banyak produk", () => {
    const m = mapOrderOnlinePayload({
      _id: { $oid: "6ac4" },
      order_id: 283033796,
      products: [{ product_id: { $oid: "pa" }, name: "Product A" }, { product_id: { $oid: "pd" }, name: "Product D" }],
      customer_data: { name: "Test", phone: "+628080080808" },
      total_price: 384942,
      status: "pending",
      created_at: { $date: "2026-10-06T09:18:47.000Z" },
      updated_at: { $date: "2026-10-06T09:18:47.000Z" },
    })!;
    expect(m.type).toBe("order.created");
    expect(m.data).toMatchObject({ product_ids: ["pa", "pd"], product_name: "Product A, Product D", total: "384942" });
  });
  it("payload tanpa order_id → null", () => {
    expect(mapOrderOnlinePayload({ foo: 1 })).toBeNull();
    expect(mapOrderOnlinePayload({ type: "order", action: "create", payload: {} })).toBeNull();
    expect(mapOrderOnlinePayload("x")).toBeNull();
  });
});
