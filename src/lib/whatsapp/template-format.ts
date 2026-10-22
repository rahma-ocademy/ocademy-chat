import { extractVariables } from "@/lib/followups/variables";

/** Bagian murni (tanpa server-only) dari pengajuan template ke Meta, agar bisa diuji. */

/** Data contoh variabel: untuk pratinjau, dan wajib dikirim ke Meta sebagai contoh isi parameter. */
export const SAMPLE_VARS: Record<string, string> = {
  customer_name: "Rani",
  order_id: "INV-0192",
  total: "Rp149.000",
  payment_link: "bayar.contoh/INV-0192",
  product_name: "Kelas Dropship",
  courier: "J&T",
  tracking_number: "JT1234567890",
  tracking_link: "lacak.contoh/JT1234567890",
};

export const META_CATEGORIES = ["UTILITY", "MARKETING"] as const;
export type MetaCategory = (typeof META_CATEGORIES)[number];

/** Nama template WhatsApp dari nama biasa: huruf kecil, angka, garis bawah (aturan Meta), maks. 512. */
export function slugTemplateName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 512);
}

/** {{customer_name}} → {{1}}, mengikuti urutan variabel pertama muncul (sama dengan `wa_param_map`). */
export function toMetaBody(body: string): { text: string; variables: string[]; examples: string[] } {
  const variables = extractVariables(body);
  const text = body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_w, name: string) => `{{${variables.indexOf(name) + 1}}}`);
  return { text, variables, examples: variables.map((v) => SAMPLE_VARS[v] ?? "contoh") };
}

/** Meta menolak body yang diawali atau diakhiri variabel. Mengembalikan pesan, atau null bila aman. */
export function metaBodyProblem(body: string): string | null {
  const t = body.trim();
  if (/^\{\{[^}]*\}\}/.test(t) || /\{\{[^}]*\}\}$/.test(t)) {
    return "Meta tidak menerima isi pesan yang diawali atau diakhiri variabel. Tambahkan teks di awal dan akhir (mis. sapaan dan penutup).";
  }
  return null;
}
