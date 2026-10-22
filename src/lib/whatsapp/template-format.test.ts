import { describe, expect, it } from "vitest";
import { metaBodyProblem, slugTemplateName, toMetaBody } from "./template-format";

describe("template-format", () => {
  it("membuat nama template WhatsApp yang valid", () => {
    expect(slugTemplateName("Pengingat Bayar!")).toBe("pengingat_bayar");
    expect(slugTemplateName("  Café – Order #1 ")).toBe("cafe_order_1");
  });

  it("mengubah variabel jadi posisi sesuai urutan kemunculan", () => {
    const r = toMetaBody("Halo {{customer_name}}, tagihan {{total}} untuk {{customer_name}}.");
    expect(r.text).toBe("Halo {{1}}, tagihan {{2}} untuk {{1}}.");
    expect(r.variables).toEqual(["customer_name", "total"]);
    expect(r.examples).toEqual(["Rani", "Rp149.000"]);
  });

  it("menolak body yang diawali/diakhiri variabel", () => {
    expect(metaBodyProblem("{{customer_name}} halo")).not.toBeNull();
    expect(metaBodyProblem("Halo {{customer_name}}")).not.toBeNull();
    expect(metaBodyProblem("Halo {{customer_name}}, terima kasih.")).toBeNull();
  });
});
