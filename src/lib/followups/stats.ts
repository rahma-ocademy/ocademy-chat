import "server-only";
import type { createSupabaseServer } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createSupabaseServer>>;

/** Ringkasan antrean follow-up (membaca lewat klien pengguna → RLS berlaku). */
export async function getJobStats(supabase: Client, businessId: string) {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const count = (status: string, col?: "sent_at" | "created_at") => {
    let q = supabase.from("followup_jobs").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", status);
    if (col) q = q.gte(col, since);
    return q;
  };
  const [pending, sent, failed] = await Promise.all([count("pending"), count("sent", "sent_at"), count("failed", "created_at")]);
  return { pending: pending.count ?? 0, sent: sent.count ?? 0, failed: failed.count ?? 0 };
}
