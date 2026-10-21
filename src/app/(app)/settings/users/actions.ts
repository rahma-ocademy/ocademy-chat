"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasPermission, requireContext, type Context } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { seatUsage } from "@/lib/team/seats";
import { INVITE_TTL_SECONDS, newInviteToken, resendWait } from "@/lib/team/invites";
import { LEVELS, PERMISSION_KEYS, type Permissions } from "@/lib/team/permissions";

export type InviteResult = { ok?: boolean; error?: string; link?: string; email?: string };

const uuid = z.string().uuid();
const NO_ACCESS = "Anda tidak punya izin mengelola pengguna.";

const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
const inviteLink = (token: string) => `${appUrl()}/invite/${token}`;
const expiresAt = () => new Date(Date.now() + INVITE_TTL_SECONDS * 1000).toISOString();

async function manager(): Promise<Context | null> {
  const ctx = await requireContext();
  return hasPermission(ctx, "user_management", "manage") ? ctx : null;
}

function readPermissions(formData: FormData): Permissions {
  const level = z.enum(LEVELS).catch("none");
  return Object.fromEntries(PERMISSION_KEYS.map((k) => [k, level.parse(formData.get(`perm_${k}`))])) as Permissions;
}

const inviteSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(80),
  email: z.string().trim().toLowerCase().email("Email tidak valid."),
  role: z.enum(["admin", "agent"]),
});

export async function inviteMember(_: InviteResult, formData: FormData): Promise<InviteResult> {
  const parsed = inviteSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await manager();
  if (!ctx) return { error: NO_ACCESS };
  const admin = createSupabaseAdmin();
  const { name, email, role } = parsed.data;

  const { data: member } = await admin.from("memberships").select("status").eq("business_id", ctx.businessId).ilike("email", email).maybeSingle();
  if (member?.status === "active") return { error: "Email ini sudah menjadi anggota." };
  if (member?.status === "deactivated") return { error: "Email ini anggota yang dinonaktifkan. Aktifkan lagi dari daftar anggota." };

  const seats = await seatUsage(admin, ctx.businessId);
  if (seats.limit !== null && seats.used >= seats.limit) {
    return { error: `Seat penuh (${seats.used} dari ${seats.limit}). Batalkan undangan lain atau upgrade paket.` };
  }

  // Undangan lama yang kedaluwarsa untuk email ini ditutup dulu agar indeks "satu undangan terbuka" tidak bentrok.
  await admin
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("business_id", ctx.businessId)
    .eq("email", email)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .lte("expires_at", new Date().toISOString());

  const { token, hash } = newInviteToken();
  const { error } = await admin.from("invitations").insert({
    business_id: ctx.businessId,
    email,
    name,
    role,
    permissions: readPermissions(formData),
    token_hash: hash,
    invited_by: ctx.user.id,
    expires_at: expiresAt(),
  });
  if (error) return { error: error.code === "23505" ? "Email ini sudah punya undangan aktif. Kirim ulang dari daftar undangan." : "Gagal membuat undangan." };

  revalidatePath("/settings/users");
  return { ok: true, link: inviteLink(token), email };
}

/** Kirim ulang = buat link baru (link lama tidak berlaku) + perpanjang masa berlaku. Ada jeda antar kirim. */
export async function resendInvite(id: string): Promise<InviteResult> {
  if (!uuid.safeParse(id).success) return { error: "Data tidak valid." };
  const ctx = await manager();
  if (!ctx) return { error: NO_ACCESS };
  const admin = createSupabaseAdmin();
  const { data: inv } = await admin
    .from("invitations")
    .select("id, email, last_sent_at, accepted_at, revoked_at")
    .eq("id", id)
    .eq("business_id", ctx.businessId)
    .maybeSingle();
  if (!inv || inv.accepted_at || inv.revoked_at) return { error: "Undangan tidak ditemukan atau sudah tidak aktif." };
  const wait = resendWait(inv.last_sent_at as string);
  if (wait > 0) return { error: `Tunggu ${wait} detik sebelum membuat link baru.` };

  const { token, hash } = newInviteToken();
  const { error } = await admin
    .from("invitations")
    .update({ token_hash: hash, expires_at: expiresAt(), last_sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Gagal membuat link baru." };
  revalidatePath("/settings/users");
  return { ok: true, link: inviteLink(token), email: inv.email as string };
}

export async function revokeInvite(id: string): Promise<InviteResult> {
  if (!uuid.safeParse(id).success) return { error: "Data tidak valid." };
  const ctx = await manager();
  if (!ctx) return { error: NO_ACCESS };
  await createSupabaseAdmin()
    .from("invitations")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", ctx.businessId)
    .is("accepted_at", null);
  revalidatePath("/settings/users");
  return { ok: true };
}

const memberSchema = z.object({ userId: uuid, role: z.enum(["admin", "agent"]) });

/** Ubah peran & izin anggota. Owner tidak bisa diubah; diri sendiri juga tidak (mencegah terkunci). */
export async function updateMember(_: InviteResult, formData: FormData): Promise<InviteResult> {
  const parsed = memberSchema.safeParse({ userId: formData.get("user_id"), role: formData.get("role") });
  if (!parsed.success) return { error: "Data tidak valid." };
  const ctx = await manager();
  if (!ctx) return { error: NO_ACCESS };
  if (parsed.data.userId === ctx.user.id) return { error: "Anda tidak bisa mengubah izin sendiri." };
  const { data, error } = await createSupabaseAdmin()
    .from("memberships")
    .update({ role: parsed.data.role, permissions: readPermissions(formData) })
    .eq("business_id", ctx.businessId)
    .eq("user_id", parsed.data.userId)
    .neq("role", "owner")
    .select("user_id");
  if (error || !data?.length) return { error: "Anggota tidak ditemukan atau tidak bisa diubah." };
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function setMemberStatus(userId: string, status: "active" | "deactivated"): Promise<InviteResult> {
  if (!uuid.safeParse(userId).success || !["active", "deactivated"].includes(status)) return { error: "Data tidak valid." };
  const ctx = await manager();
  if (!ctx) return { error: NO_ACCESS };
  if (userId === ctx.user.id) return { error: "Anda tidak bisa menonaktifkan diri sendiri." };
  const admin = createSupabaseAdmin();
  if (status === "active") {
    const seats = await seatUsage(admin, ctx.businessId);
    if (seats.limit !== null && seats.used >= seats.limit) return { error: `Seat penuh (${seats.used} dari ${seats.limit}).` };
  }
  const { data, error } = await admin
    .from("memberships")
    .update({ status })
    .eq("business_id", ctx.businessId)
    .eq("user_id", userId)
    .neq("role", "owner")
    .select("user_id");
  if (error || !data?.length) return { error: "Anggota tidak ditemukan atau tidak bisa diubah." };
  // Percakapan yang dipegang anggota nonaktif dilepas agar tidak terbengkalai.
  if (status === "deactivated") {
    await admin.from("conversations").update({ assignee_id: null }).eq("business_id", ctx.businessId).eq("assignee_id", userId).eq("status", "open");
  }
  revalidatePath("/settings/users");
  revalidatePath("/chat");
  return { ok: true };
}
