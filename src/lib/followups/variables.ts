const VAR_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function extractVariables(body: string): string[] {
  return [...new Set([...body.matchAll(VAR_RE)].map((m) => m[1]))];
}

export type RenderResult = { text: string; missing: string[] };

/**
 * Satu putaran penggantian: nilai yang berisi "{{x}}" TIDAK dievaluasi ulang.
 * Variabel tanpa nilai & tanpa cadangan dilaporkan di `missing` (pemanggil memutuskan; jangan kirim "{{x}}" ke pelanggan).
 */
export function renderTemplate(
  body: string,
  vars: Record<string, unknown>,
  fallbacks: Record<string, string> = {},
): RenderResult {
  const missing = new Set<string>();
  const text = body.replace(VAR_RE, (whole, name: string) => {
    const v = vars[name];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    if (fallbacks[name] !== undefined) return fallbacks[name];
    missing.add(name);
    return whole;
  });
  return { text, missing: [...missing] };
}

/** Kosakata variabel OrderOnline → kosakata internal aplikasi (satu bahasa di seluruh sistem). */
export const ORDERONLINE_VAR_MAP: Record<string, string> = {
  name: "customer_name",
  e_payment_link: "payment_link",
  total_price: "total",
  receipt_number: "tracking_number",
  shipping_courier: "courier",
  order_details_link: "tracking_link",
};

export function convertOrderOnlineBody(body: string): string {
  return body.replace(VAR_RE, (_w, name: string) => `{{${ORDERONLINE_VAR_MAP[name] ?? name}}}`);
}
