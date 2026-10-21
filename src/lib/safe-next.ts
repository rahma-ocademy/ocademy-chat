/** Tujuan redirect setelah login/daftar: hanya path internal (bukan //host atau URL absolut). */
export function safeNext(value: unknown, fallback = "/chat"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value.length > 300 ? fallback : value;
}

export const isInvitePath = (path: string) => /^\/invite\/[A-Za-z0-9_-]+$/.test(path);
