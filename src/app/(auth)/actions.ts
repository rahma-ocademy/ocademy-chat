"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BUSINESS_COOKIE, requireContext } from "@/lib/auth";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isInvitePath, safeNext } from "@/lib/safe-next";

export type AuthState = { error?: string; message?: string };

const credentials = z.object({
  email: z.string().trim().email("Email tidak valid."),
  password: z.string().min(8, "Kata sandi minimal 8 karakter."),
});

export async function login(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  // Pesan sengaja generik: tidak membocorkan apakah email terdaftar.
  if (error) return { error: "Email atau kata sandi salah." };
  redirect(safeNext(formData.get("next")));
}

export async function register(_: AuthState, formData: FormData): Promise<AuthState> {
  const next = safeNext(formData.get("next"));
  // Daftar dari link undangan: tidak membuat bisnis sendiri, langsung bergabung ke bisnis pengundang.
  const viaInvite = isInvitePath(next);
  const business = viaInvite ? z.string().optional() : z.string().trim().min(2, "Nama bisnis minimal 2 karakter.").max(80);
  const parsed = credentials
    .extend({ business })
    .safeParse({ email: formData.get("email"), password: formData.get("password"), business: viaInvite ? undefined : formData.get("business") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: viaInvite ? {} : { business_name: parsed.data.business } },
  });
  if (error) return { error: "Pendaftaran gagal. Periksa data Anda atau coba email lain." };

  // Konfirmasi email aktif → belum ada sesi. Bisnis dibuat otomatis saat login pertama (lib/auth.ts).
  if (!data.session) {
    return {
      message: viaInvite
        ? "Pendaftaran berhasil. Konfirmasi email Anda, lalu buka lagi link undangan dan masuk."
        : "Pendaftaran berhasil. Cek email Anda untuk konfirmasi, lalu masuk.",
    };
  }
  redirect(next);
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Pindah bisnis aktif (hanya ke bisnis tempat pengguna menjadi anggota aktif). */
export async function switchBusiness(businessId: string) {
  if (!z.string().uuid().safeParse(businessId).success) return;
  const ctx = await requireContext();
  if (!ctx.businessIds.includes(businessId)) return;
  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, businessId, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/chat");
}
