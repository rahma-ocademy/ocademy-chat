"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServer } from "@/lib/supabase/server";

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
  redirect("/followups");
}

export async function register(_: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentials
    .extend({ business: z.string().trim().min(2, "Nama bisnis minimal 2 karakter.").max(80) })
    .safeParse({ email: formData.get("email"), password: formData.get("password"), business: formData.get("business") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { business_name: parsed.data.business } },
  });
  if (error) return { error: "Pendaftaran gagal. Periksa data Anda atau coba email lain." };

  // Konfirmasi email aktif → belum ada sesi. Bisnis dibuat otomatis saat login pertama (lib/auth.ts).
  if (!data.session) return { message: "Pendaftaran berhasil. Cek email Anda untuk konfirmasi, lalu masuk." };
  redirect("/followups");
}

export async function logout() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
