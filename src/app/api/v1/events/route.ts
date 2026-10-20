import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { authErrorCode, authenticateApiKey } from "@/lib/apikeys";
import { apiError, parseJson } from "@/lib/http";
import { ingestEvent } from "@/lib/followups/engine";
import { normalizePhone } from "@/lib/phone";

const schema = z.object({
  type: z.string().regex(/^[a-z0-9_.:-]{1,64}$/, "huruf kecil, angka, titik, titik dua, garis"),
  contact: z.object({ phone: z.string().max(32).optional(), name: z.string().max(120).optional() }).default({}),
  data: z.record(z.string(), z.unknown()).default({}),
});

/** POST /api/v1/events — aplikasi pihak ketiga mengirim event (order.created, cart.abandoned, ...). */
export async function POST(req: Request) {
  const admin = createSupabaseAdmin();
  const auth = await authenticateApiKey(admin, req, "events:write");
  if (!auth.ok) return apiError(auth.status, authErrorCode(auth.status), auth.message);

  const key = req.headers.get("idempotency-key")?.trim();
  if (!key || key.length > 200) {
    return apiError(400, "idempotency_key_required", "Header Idempotency-Key (maks. 200 karakter) wajib agar event ganda tidak mengirim dua kali.");
  }

  const body = await parseJson(req, schema);
  if (!body.ok) return body.res;

  const phone = normalizePhone(body.data.contact.phone);
  if (body.data.contact.phone && !phone) return apiError(422, "invalid_phone", "contact.phone bukan nomor telepon yang valid.");

  const result = await ingestEvent(admin, {
    businessId: auth.principal.businessId,
    integrationId: auth.principal.integrationId,
    type: body.data.type,
    idempotencyKey: `api:${key}`,
    contact: { phone, name: body.data.contact.name },
    data: body.data.data,
  });

  return NextResponse.json(
    {
      data: {
        event_id: result.eventId ?? null,
        duplicate: result.duplicate,
        jobs_scheduled: result.jobsCreated,
        jobs_cancelled: result.jobsCancelled,
        ...(result.note ? { note: result.note } : {}),
      },
    },
    { status: result.duplicate ? 200 : 202 },
  );
}
