import "server-only";
import type { Admin } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/plans";

/** Seat = anggota aktif + undangan yang masih terbuka (pola Cekat: "2 of 2 seats used"). */
export async function seatUsage(admin: Admin, businessId: string) {
  const [members, invites, ent] = await Promise.all([
    admin.from("memberships").select("user_id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "active"),
    admin
      .from("invitations")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString()),
    getEntitlements(admin, businessId),
  ]);
  return { used: (members.count ?? 0) + (invites.count ?? 0), limit: ent?.limits.seats ?? null };
}
