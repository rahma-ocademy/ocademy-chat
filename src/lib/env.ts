import "server-only";

/** Baca env wajib. Gagal keras dengan pesan jelas, bukan `undefined` yang merambat. */
export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Env ${name} belum diisi. Lihat .env.example.`);
  return v;
}

export const optionalEnv = (name: string): string | undefined => process.env[name] || undefined;
