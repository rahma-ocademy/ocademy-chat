import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { authErrorCode, authenticateApiKey } from "@/lib/apikeys";
import { apiError, parseJson } from "@/lib/http";
import { renderTemplate } from "@/lib/followups/variables";
import { pickBody } from "@/lib/followups/engine";

const schema = z.object({ variables: z.record(z.string(), z.unknown()).default({}) });

/** POST /api/v1/followup-templates/{id}/preview — render dengan data contoh; `missing` = variabel yang belum terisi. */
export async function POST(req: Request, ctx: RouteContext<"/api/v1/followup-templates/[id]/preview">) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return apiError(404, "not_found", "Template tidak ditemukan.");
  const admin = createSupabaseAdmin();
  const auth = await authenticateApiKey(admin, req, "templates:read");
  if (!auth.ok) return apiError(auth.status, authErrorCode(auth.status), auth.message);

  const body = await parseJson(req, schema);
  if (!body.ok) return body.res;

  const { data: t } = await admin
    .from("followup_templates").select("body, variants").eq("id", id).eq("business_id", auth.principal.businessId).maybeSingle();
  if (!t) return apiError(404, "not_found", "Template tidak ditemukan.");

  const out = renderTemplate(pickBody(t, body.data.variables), body.data.variables);
  return NextResponse.json({ data: out });
}
