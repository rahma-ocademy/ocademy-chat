import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { authErrorCode, authenticateApiKey } from "@/lib/apikeys";
import { apiError, pageMeta, parseJson, readPage } from "@/lib/http";
import { extractVariables } from "@/lib/followups/variables";

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(60).default("umum"),
  body: z.string().min(1).max(4096),
  channel: z.enum(["whatsapp", "any"]).default("whatsapp"),
  wa_template_name: z.string().max(120).optional(),
  wa_param_map: z.record(z.string(), z.string()).default({}),
  external_ref: z.string().max(120).optional(),
});

const FIELDS =
  "id, name, category, body, variables, channel, wa_template_name, wa_param_map, source, external_ref, version, status, created_at, updated_at";

/** GET /api/v1/followup-templates?category&status&page&per_page */
export async function GET(req: Request) {
  const admin = createSupabaseAdmin();
  const auth = await authenticateApiKey(admin, req, "templates:read");
  if (!auth.ok) return apiError(auth.status, authErrorCode(auth.status), auth.message);

  const url = new URL(req.url);
  const p = readPage(url);
  let q = admin
    .from("followup_templates")
    .select(FIELDS, { count: "exact" })
    .eq("business_id", auth.principal.businessId)
    .order("created_at", { ascending: false })
    .range(p.from, p.to);
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  if (category) q = q.eq("category", category);
  if (status) q = q.eq("status", status);

  const { data, count, error } = await q;
  if (error) return apiError(500, "internal", "Gagal membaca template.");
  return NextResponse.json({ data, meta: pageMeta(p, count ?? 0) });
}

/** POST /api/v1/followup-templates — template milik integrasi pemanggil (source=api). */
export async function POST(req: Request) {
  const admin = createSupabaseAdmin();
  const auth = await authenticateApiKey(admin, req, "templates:write");
  if (!auth.ok) return apiError(auth.status, authErrorCode(auth.status), auth.message);

  const body = await parseJson(req, createSchema);
  if (!body.ok) return body.res;

  const { data, error } = await admin
    .from("followup_templates")
    .insert({
      ...body.data,
      business_id: auth.principal.businessId,
      integration_id: auth.principal.integrationId,
      source: "api",
      variables: extractVariables(body.data.body),
    })
    .select(FIELDS)
    .single();

  if (error) {
    if (error.code === "23505") return apiError(409, "conflict", "external_ref sudah dipakai oleh template lain.");
    return apiError(500, "internal", "Gagal membuat template.");
  }
  return NextResponse.json({ data }, { status: 201 });
}
