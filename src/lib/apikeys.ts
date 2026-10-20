import "server-only";
import { randomBytes } from "node:crypto";
import { sha256Hex } from "@/lib/crypto";
import type { Admin } from "@/lib/supabase/server";

export const SCOPES = ["templates:read", "templates:write", "events:write", "messages:send"] as const;
export type Scope = (typeof SCOPES)[number];

/** Kunci hanya ditampilkan sekali. Yang disimpan: prefiks (untuk dikenali) + hash SHA-256. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `ock_live_${randomBytes(24).toString("base64url")}`;
  return { key, prefix: key.slice(0, 13), hash: sha256Hex(key) };
}

export type ApiPrincipal = {
  keyId: string;
  businessId: string;
  integrationId: string | null;
  scopes: string[];
};

export type AuthResult = { ok: true; principal: ApiPrincipal } | { ok: false; status: 401 | 403 | 503; message: string };

export const authErrorCode = (status: 401 | 403 | 503) =>
  status === 401 ? "unauthorized" : status === 403 ? "forbidden" : "unavailable";

export async function authenticateApiKey(admin: Admin, req: Request, needed: Scope): Promise<AuthResult> {
  const header = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(ock_live_[A-Za-z0-9_-]+)$/.exec(header);
  if (!m) return { ok: false, status: 401, message: "Header Authorization: Bearer ock_live_… diperlukan." };

  const { data, error } = await admin
    .from("api_keys")
    .select("id, business_id, integration_id, scopes, revoked_at")
    .eq("key_hash", sha256Hex(m[1]))
    .maybeSingle();

  // Gangguan database bukan "kunci salah": klien perlu tahu agar mencoba lagi, bukan mengganti kunci.
  if (error) return { ok: false, status: 503, message: "Layanan sementara tidak tersedia. Coba lagi sebentar." };
  if (!data || data.revoked_at) return { ok: false, status: 401, message: "Kunci API tidak valid atau sudah dicabut." };
  if (!data.scopes.includes(needed)) return { ok: false, status: 403, message: `Kunci ini tidak punya izin ${needed}.` };

  // Best effort; kegagalan mencatat waktu pakai tidak boleh menggagalkan request.
  void admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  return {
    ok: true,
    principal: { keyId: data.id, businessId: data.business_id, integrationId: data.integration_id, scopes: data.scopes },
  };
}
