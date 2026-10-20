import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { apiError, MAX_BODY_BYTES } from "@/lib/http";
import { ingestEvent } from "@/lib/followups/engine";
import { mapOrderOnlinePayload } from "@/lib/orderonline/webhook";
import { normalizePhone } from "@/lib/phone";
import { sha256Hex } from "@/lib/crypto";

/**
 * Webhook OrderOnline (cakupan order:*). Autentikasi: secret acak di URL (tiap integrasi punya sendiri).
 * Payload yang belum bisa dipetakan tetap DISIMPAN sebagai `orderonline.unmapped` agar format aslinya bisa
 * dilihat dan pemetaan di lib/orderonline/webhook.ts disesuaikan (format publiknya belum terdokumentasi).
 */
export async function POST(req: Request, ctx: RouteContext<"/api/webhooks/orderonline/[secret]">) {
  const { secret } = await ctx.params;
  if (!/^[a-f0-9]{48}$/.test(secret)) return apiError(404, "not_found", "Webhook tidak ditemukan.");

  const admin = createSupabaseAdmin();
  const { data: integ } = await admin
    .from("integrations")
    .select("id, business_id, status")
    .eq("webhook_secret", secret)
    .eq("type", "orderonline")
    .maybeSingle();
  if (!integ || integ.status === "disconnected") return apiError(404, "not_found", "Webhook tidak ditemukan.");

  const text = await req.text();
  if (text.length > MAX_BODY_BYTES) return apiError(413, "payload_too_large", "Body melebihi 256 KB.");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return apiError(400, "invalid_json", "Body bukan JSON yang valid.");
  }

  const mapped = mapOrderOnlinePayload(raw);
  const result = await ingestEvent(admin, {
    businessId: integ.business_id,
    integrationId: integ.id,
    type: mapped?.type ?? "orderonline.unmapped",
    idempotencyKey: mapped?.idempotencyKey ?? `oo:raw:${sha256Hex(text).slice(0, 32)}`,
    contact: { phone: normalizePhone(mapped?.contact.phone), name: mapped?.contact.name },
    data: mapped?.data ?? {},
    raw,
  });

  return NextResponse.json({ data: { received: true, mapped: Boolean(mapped), duplicate: result.duplicate, jobs_scheduled: result.jobsCreated } });
}
