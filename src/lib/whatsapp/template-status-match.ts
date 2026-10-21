/** Bagian murni (tanpa server-only) dari pencocokan status template, agar bisa diuji. */

export type MetaTemplateLite = { name: string; language: string; status: string; rejected_reason: string | null };

/**
 * Cari status template `name` di daftar template Meta. Bahasa yang sama dengan aplikasi diutamakan
 * ("id" cocok dengan "id" maupun "id_ID"); bila tidak ada, pakai bahasa lain dengan nama yang sama.
 */
export function pickTemplateStatus(metas: MetaTemplateLite[], name: string, language: string): { status: string; reason: string | null } {
  const same = metas.filter((m) => m.name === name);
  if (same.length === 0) return { status: "NOT_FOUND", reason: `Template “${name}” tidak ditemukan di WhatsApp Manager.` };
  const lang = language.toLowerCase();
  const hit = same.find((m) => m.language.toLowerCase() === lang) ?? same.find((m) => m.language.toLowerCase().startsWith(lang)) ?? same[0];
  return { status: hit.status, reason: hit.rejected_reason };
}

/** Label & gaya badge untuk status Meta (dipakai halaman Template). */
export function metaStatusView(status: string | null, hasWaTemplate: boolean) {
  if (!hasWaTemplate) return { label: "Teks biasa", cls: "badge badge-muted", hint: "Tidak memakai template WhatsApp: hanya terkirim dalam 24 jam sejak pelanggan terakhir chat." };
  switch (status) {
    case "APPROVED":
      return { label: "Disetujui", cls: "badge badge-ok", hint: "Disetujui Meta: bisa dikirim kapan saja, termasuk di luar jendela 24 jam." };
    case "PENDING":
    case "IN_APPEAL":
      return { label: "Menunggu review", cls: "badge badge-warn", hint: "Sedang ditinjau Meta. Belum bisa dikirim di luar jendela 24 jam." };
    case "REJECTED":
      return { label: "Ditolak", cls: "badge badge-bad", hint: "Ditolak Meta. Perbaiki isi template di WhatsApp Manager lalu ajukan ulang." };
    case "PAUSED":
    case "DISABLED":
    case "LIMIT_EXCEEDED":
      return { label: status === "PAUSED" ? "Dijeda" : "Nonaktif", cls: "badge badge-bad", hint: "Dijeda/dinonaktifkan Meta (biasanya karena kualitas rendah). Pesan tidak terkirim." };
    case "NOT_FOUND":
      return { label: "Tidak ditemukan", cls: "badge badge-bad", hint: "Nama template tidak ada di WABA yang terhubung. Periksa ejaan nama atau buat templatenya di WhatsApp Manager." };
    case null:
    case undefined:
      return { label: "Belum dicek", cls: "badge badge-muted", hint: "Klik “Cek status Meta” untuk mengambil status terbaru." };
    default:
      return { label: status, cls: "badge badge-muted", hint: "Status dari Meta." };
  }
}
