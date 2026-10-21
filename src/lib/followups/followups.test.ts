import { describe, expect, it } from "vitest";
import { computeScheduledAt } from "@/lib/followups/schedule";
import { convertOrderOnlineBody, extractVariables, renderTemplate, templateParams } from "@/lib/followups/variables";
import { matchesConditions } from "@/lib/followups/conditions";
import { normalizePhone } from "@/lib/phone";

const iso = (d: Date) => d.toISOString();
// 10.00 WIB = 03.00 UTC (Asia/Jakarta = UTC+7 tanpa DST)
const base = new Date("2026-10-20T03:00:00Z");

describe("renderTemplate", () => {
  it("mengisi variabel, memakai cadangan, dan melaporkan yang hilang", () => {
    const r = renderTemplate("Halo {{customer_name}}, {{order_id}} {{x}}", { order_id: "INV-1" }, { customer_name: "Kak" });
    expect(r.text).toBe("Halo Kak, INV-1 {{x}}");
    expect(r.missing).toEqual(["x"]);
  });
  it("tidak mengevaluasi ulang nilai yang berisi kurung kurawal", () => {
    const r = renderTemplate("{{a}}", { a: "{{b}}", b: "rahasia" });
    expect(r.text).toBe("{{b}}");
  });
  it("nilai kosong dianggap tidak ada", () => {
    expect(renderTemplate("{{a}}", { a: "  " }).missing).toEqual(["a"]);
  });
  it("extractVariables unik", () => {
    expect(extractVariables("{{a}} {{ b }} {{a}}")).toEqual(["a", "b"]);
  });
  it("memetakan variabel OrderOnline ke kosakata internal", () => {
    expect(convertOrderOnlineBody("Halo {{name}}, bayar: {{e_payment_link}} {{product_name}}")).toBe(
      "Halo {{customer_name}}, bayar: {{payment_link}} {{product_name}}",
    );
  });
});

describe("computeScheduledAt", () => {
  it("jeda biasa tanpa jendela", () => {
    expect(iso(computeScheduledAt(base, { template_id: "t", delay_minutes: 120 }, { mode: "anytime" }))).toBe("2026-10-20T05:00:00.000Z");
  });
  it("H+1 pukul 11.00 = hari kalender berikutnya jam 11 WIB", () => {
    expect(iso(computeScheduledAt(base, { template_id: "t", delay_minutes: 1440, at_hour: 11 }, { mode: "anytime" }))).toBe("2026-10-21T04:00:00.000Z");
  });
  it("hari yang sama tapi jam sudah lewat → kirim sekarang, bukan di masa lalu", () => {
    expect(iso(computeScheduledAt(base, { template_id: "t", delay_minutes: 0, at_hour: 8 }, { mode: "anytime" }))).toBe(iso(base));
  });
  it("di luar jam kirim (malam) → mulai jendela berikutnya", () => {
    const night = new Date("2026-10-20T15:30:00Z"); // 22.30 WIB
    const w = { mode: "custom", start: "08:00", end: "21:00" } as const;
    expect(iso(computeScheduledAt(night, { template_id: "t", delay_minutes: 0 }, w))).toBe("2026-10-21T01:00:00.000Z"); // 08.00 WIB
  });
  it("sebelum jam mulai → jam mulai hari yang sama", () => {
    const early = new Date("2026-10-19T23:00:00Z"); // 06.00 WIB tgl 20
    const w = { mode: "custom", start: "08:00", end: "21:00" } as const;
    expect(iso(computeScheduledAt(early, { template_id: "t", delay_minutes: 0 }, w))).toBe("2026-10-20T01:00:00.000Z");
  });
  it("di dalam jendela tidak diubah", () => {
    const w = { mode: "custom", start: "08:00", end: "21:00" } as const;
    expect(iso(computeScheduledAt(base, { template_id: "t", delay_minutes: 120 }, w))).toBe("2026-10-20T05:00:00.000Z");
  });
  it("jendela semalam (22.00–06.00) menolak siang hari", () => {
    const w = { mode: "custom", start: "22:00", end: "06:00" } as const;
    expect(iso(computeScheduledAt(base, { template_id: "t", delay_minutes: 120 }, w))).toBe("2026-10-20T15:00:00.000Z"); // 22.00 WIB
  });
});

describe("matchesConditions", () => {
  const data = { payment_status: "pending", total: "150000", contact: { phone: "62812" } };
  it("eq / neq / gt / exists", () => {
    expect(matchesConditions([{ field: "payment_status", op: "eq", value: "pending" }], data)).toBe(true);
    expect(matchesConditions([{ field: "payment_status", op: "neq", value: "paid" }], data)).toBe(true);
    expect(matchesConditions([{ field: "total", op: "gt", value: 100000 }], data)).toBe(true);
    expect(matchesConditions([{ field: "contact.phone", op: "exists" }], data)).toBe(true);
  });
  it("data tidak ada → eq gagal, neq lolos", () => {
    expect(matchesConditions([{ field: "nope", op: "eq", value: "x" }], data)).toBe(false);
    expect(matchesConditions([{ field: "nope", op: "neq", value: "x" }], data)).toBe(true);
  });
  it("tanpa kondisi = selalu cocok", () => expect(matchesConditions([], data)).toBe(true));
});

describe("normalizePhone", () => {
  it("menormalkan format Indonesia", () => {
    expect(normalizePhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizePhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizePhone("81234567890")).toBe("6281234567890");
    expect(normalizePhone("0062812345678")).toBe("62812345678");
  });
  it("menolak yang tidak valid", () => {
    expect(normalizePhone("abc")).toBeUndefined();
    expect(normalizePhone("123")).toBeUndefined();
    expect(normalizePhone(undefined)).toBeUndefined();
  });
});

describe("templateParams", () => {
  it("urut numerik, nilai kosong jadi '-'", () => {
    expect(templateParams({ "2": "order_id", "1": "customer_name", "10": "total", x: "abaikan" }, { customer_name: "Rani", order_id: "", total: 5 })).toEqual(["Rani", "-", "5"]);
  });
});
