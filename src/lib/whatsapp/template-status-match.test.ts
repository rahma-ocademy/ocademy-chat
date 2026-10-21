import { describe, expect, it } from "vitest";
import { metaStatusView, pickTemplateStatus } from "./template-status-match";

const metas = [
  { name: "pengingat_bayar", language: "en_US", status: "REJECTED", rejected_reason: "INVALID_FORMAT" },
  { name: "pengingat_bayar", language: "id", status: "APPROVED", rejected_reason: null },
  { name: "resi_kirim", language: "en_US", status: "PENDING", rejected_reason: null },
];

describe("pickTemplateStatus", () => {
  it("mengutamakan bahasa aplikasi", () => {
    expect(pickTemplateStatus(metas, "pengingat_bayar", "id")).toEqual({ status: "APPROVED", reason: null });
  });
  it("jatuh ke bahasa lain bila bahasa aplikasi tidak ada", () => {
    expect(pickTemplateStatus(metas, "resi_kirim", "id")).toEqual({ status: "PENDING", reason: null });
  });
  it("NOT_FOUND bila nama tidak ada di WABA", () => {
    expect(pickTemplateStatus(metas, "tidak_ada", "id").status).toBe("NOT_FOUND");
  });
});

describe("metaStatusView", () => {
  it("template tanpa nama WhatsApp = teks biasa", () => {
    expect(metaStatusView(null, false).label).toBe("Teks biasa");
  });
  it("memetakan status Meta ke label Indonesia", () => {
    expect(metaStatusView("APPROVED", true).label).toBe("Disetujui");
    expect(metaStatusView("PENDING", true).label).toBe("Menunggu review");
    expect(metaStatusView("REJECTED", true).label).toBe("Ditolak");
    expect(metaStatusView(null, true).label).toBe("Belum dicek");
  });
});
