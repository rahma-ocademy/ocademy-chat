"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BUSINESS_COOKIE } from "@/lib/auth";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { INVITE_TOKEN, hashInviteToken, inviteState, sameEmail } from "@/lib/team/invites";

export type AcceptState = { error?: string };

/** Terima undangan: hanya untuk akun yang email-nya sama dengan email undangan. */
export async function acceptInvite(token: string): Promise<AcceptState> {
  if (!INVITE_TOKEN.test(token)) return { error: "Link undangan tidak valid." };
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return { error: "Masuk dulu untuk menerima undangan." };

  const admin = createSupabaseAdmin();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, business_id, email, name, role, permissions, expires_at, accepted_at, revoked_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!inv || inviteState(inv) !== "pending") return { error: "Undangan tidak berlaku lagi. Minta link baru ke admin bisnis." };
  if (!sameEmail(user.email, inv.email)) return { error: `Undangan ini untuk ${inv.email}. Masuk dengan email tersebut.` };

  // Tandai diterima lebih dulu (bersyarat masih terbuka) supaya satu token tidak bisa dipakai dua kali.
  const { data: claimed } = await admin
    .from("invitations")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", inv.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id");
  if (!claimed?.length) return { error: "Undangan sudah dipakai." };

  const { error } = await admin.from("memberships").upsert(
    {
      business_id: inv.business_id,
      user_id: user.id,
      role: inv.role,
      permissions: inv.permissions,
      email: user.email,
      name: inv.name,
      status: "active",
    },
    { onConflict: "business_id,user_id" },
  );
  if (error) {
    await admin.from("invitations").update({ accepted_at: null, accepted_by: null }).eq("id", inv.id);
    return { error: "Gagal bergabung. Coba lagi." };
  }

  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, inv.business_id as string, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/chat");
}
