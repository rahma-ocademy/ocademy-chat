import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { apiError } from "@/lib/http";
import { processDueJobs } from "@/lib/followups/engine";

function authorized(req: Request, secret: string) {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return apiError(503, "not_configured", "CRON_SECRET belum diisi.");
  if (!authorized(req, secret)) return apiError(401, "unauthorized", "Bearer token salah.");
  const summary = await processDueJobs(createSupabaseAdmin(), { limit: 25 });
  return NextResponse.json({ data: summary });
}

// GET untuk cron platform (mis. Vercel Cron), POST untuk pemicu manual / scheduler lain.
export const GET = run;
export const POST = run;
