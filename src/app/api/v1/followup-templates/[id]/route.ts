import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { authErrorCode, authenticateApiKey, type ApiPrincipal } from "@/lib/apikeys";
import { apiError, parseJson } from "@/lib/http";
import { extractVariables } from "@/lib/followups/variables";

const patchSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    category: z.string().trim().min(1).max(60),
    body: z.string().min(1).max(4096),
    channel: z.enum(["whatsapp", "any"]),
    wa_template_name: z.string().max(120).nullable(),
    wa_param_map: z.record(z.string(), z.string()),
    status: z.enum(["draft", "active", "archived"]),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Kirim minimal satu field.");

const FIELDS =
  "id, name, category, body, variables, channel, wa_template_name, wa_param_map, source, integration_id, external_ref, version, status, created_at, updated_at";
const uuid = z.string().uuid();

async function load(id: string, principal: ApiPrincipal) {
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("followup_templates").select(FIELDS).eq("id", id).eq("business_id", principal.businessId).maybeSingle();
  return { admin, row: data };
}

/** Integrasi hanya boleh mengubah template yang dibuatnya sendiri; template aplikasi/OrderOnline read-only. */
const ownedBy = (row: { source: string; integration_id: string | null }, p: ApiPrincipal) =>
  row.source === "api" && row.integration_id !== null && row.integration_id === p.integrationId;

export async function GET(req: Request, ctx: RouteContext<"/api/v1/followup-templates/[id]">) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return apiError(404, "not_found", "Template tidak ditemukan.");
  const auth = await authenticateApiKey(createSupabaseAdmin(), req, "templates:read");
  if (!auth.ok) return apiError(auth.status, authErrorCode(auth.status), auth.message);
  const { row } = await load(id, auth.principal);
  if (!row) return apiError(404, "not_found", "Template tidak ditemukan.");
  return NextResponse.json({ data: row });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/v1/followup-templates/[id]">) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return apiError(404, "not_found", "Template tidak ditemukan.");
  const auth = await authenticateApiKey(createSupabaseAdmin(), req, "templates:write");
  if (!auth.ok) return apiError(auth.status, authErrorCode(auth.status), auth.message);

  const { admin, row } = await load(id, auth.principal);
  if (!row) return apiError(404, "not_found", "Template tidak ditemukan.");
  if (!ownedBy(row, auth.principal)) return apiError(403, "forbidden", "Template ini bukan milik integrasi Anda.");

  const body = await parseJson(req, patchSchema);
  if (!body.ok) return body.res;

  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
  if (body.data.body !== undefined && body.data.body !== row.body) {
    patch.variables = extractVariables(body.data.body);
    patch.version = row.version + 1;
  }
  const { data, error } = await admin.from("followup_templates").update(patch).eq("id", id).select(FIELDS).single();
  if (error) return apiError(500, "internal", "Gagal memperbarui template.");
  return NextResponse.json({ data });
}

/** DELETE = arsipkan (aturan yang memakai template tidak rusak). */
export async function DELETE(req: Request, ctx: RouteContext<"/api/v1/followup-templates/[id]">) {
  const { id } = await ctx.params;
  if (!uuid.safeParse(id).success) return apiError(404, "not_found", "Template tidak ditemukan.");
  const auth = await authenticateApiKey(createSupabaseAdmin(), req, "templates:write");
  if (!auth.ok) return apiError(auth.status, authErrorCode(auth.status), auth.message);

  const { admin, row } = await load(id, auth.principal);
  if (!row) return apiError(404, "not_found", "Template tidak ditemukan.");
  if (!ownedBy(row, auth.principal)) return apiError(403, "forbidden", "Template ini bukan milik integrasi Anda.");

  const { error } = await admin.from("followup_templates").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return apiError(500, "internal", "Gagal mengarsipkan template.");
  return new NextResponse(null, { status: 204 });
}
