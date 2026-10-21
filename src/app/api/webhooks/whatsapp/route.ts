import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { apiError, MAX_BODY_BYTES } from "@/lib/http";
import { optionalEnv } from "@/lib/env";
import { parseWebhook, verifySignature } from "@/lib/whatsapp/webhook";
import { applyEvents } from "@/lib/whatsapp/channel";

/**
 * Webhook WhatsApp Cloud API. Satu URL untuk semua nomor: inbox ditentukan dari metadata.phone_number_id.
 * Daftarkan di Meta App → WhatsApp → Configuration, dengan field `messages` (dan `smb_message_echoes`,
 * `history`, `smb_app_state_sync` untuk Coexistence).
 */

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// Verifikasi URL oleh Meta: kembalikan hub.challenge bila verify token cocok.
export async function GET(req: Request) {
  const verifyToken = optionalEnv("WHATSAPP_VERIFY_TOKEN");
  if (!verifyToken) return apiError(503, "not_configured", "WHATSAPP_VERIFY_TOKEN belum diisi.");
  const url = new URL(req.url);
  const token = url.searchParams.get("hub.verify_token") ?? "";
  if (url.searchParams.get("hub.mode") !== "subscribe" || !same(token, verifyToken)) {
    return apiError(403, "forbidden", "Verify token salah.");
  }
  return new NextResponse(url.searchParams.get("hub.challenge") ?? "", { headers: { "content-type": "text/plain" } });
}

export async function POST(req: Request) {
  const appSecret = optionalEnv("META_APP_SECRET");
  if (!appSecret) return apiError(503, "not_configured", "META_APP_SECRET belum diisi.");

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES * 4) return apiError(413, "payload_too_large", "Body terlalu besar.");
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return apiError(401, "invalid_signature", "Tanda tangan webhook tidak valid.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return apiError(400, "invalid_json", "Body bukan JSON yang valid.");
  }

  try {
    const summary = await applyEvents(createSupabaseAdmin(), parseWebhook(payload));
    return NextResponse.json({ data: summary });
  } catch {
    // 5xx → Meta mengirim ulang; penyimpanan idempoten (wamid unik) mencegah pesan ganda.
    return apiError(503, "unavailable", "Gagal memproses webhook, akan dicoba ulang oleh Meta.");
  }
}
