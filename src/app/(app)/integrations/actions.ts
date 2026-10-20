"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { generateApiKey, SCOPES } from "@/lib/apikeys";
import { encryptSecret } from "@/lib/crypto";
import { can, getEntitlements } from "@/lib/plans";
import { login, OrderOnlineError } from "@/lib/orderonline/client";
import { syncOrderOnline } from "@/lib/orderonline/sync";

export type KeyState = { error?: string; key?: string; name?: string };
export type OOState = { error?: string; message?: string };

export async function createApiKey(_: KeyState, formData: FormData): Promise<KeyState> {
  const parsed = z
    .object({
      name: z.string().trim().min(2, "Nama integrasi minimal 2 karakter.").max(80),
      scopes: z.array(z.enum(SCOPES)).min(1, "Pilih minimal satu izin."),
    })
    .safeParse({ name: formData.get("name"), scopes: formData.getAll("scopes") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, businessId } = await requireContext();
  if (!can(await getEntitlements(createSupabaseAdmin(), businessId), "open_api")) {
    return { error: "Paket Anda belum mencakup Open API. Upgrade paket di halaman Usage." };
  }

  const { data: integ, error: iErr } = await supabase
    .from("integrations")
    .insert({ business_id: businessId, type: "custom", name: parsed.data.name })
    .select("id")
    .single();
  if (iErr || !integ) return { error: "Gagal membuat integrasi." };

  const { key, prefix, hash } = generateApiKey();
  const { error: kErr } = await supabase.from("api_keys").insert({
    business_id: businessId,
    integration_id: integ.id,
    name: parsed.data.name,
    key_prefix: prefix,
    key_hash: hash,
    scopes: parsed.data.scopes,
  });
  if (kErr) {
    await supabase.from("integrations").delete().eq("id", integ.id);
    return { error: "Gagal membuat kunci API." };
  }
  revalidatePath("/integrations");
  return { key, name: parsed.data.name };
}

export async function revokeApiKey(id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  const { supabase, businessId } = await requireContext();
  await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", id).eq("business_id", businessId);
  revalidatePath("/integrations");
}

// ─── OrderOnline ──────────────────────────────────────────────────────────

const errText = (e: unknown) => (e instanceof OrderOnlineError ? e.message : (e as Error).message);

export async function connectOrderOnline(_: OOState, formData: FormData): Promise<OOState> {
  const token = String(formData.get("token") ?? "").trim();
  if (token.length < 8) return { error: "Open API Token tidak valid." };
  if (!process.env.ORDERONLINE_PARTNER_API_KEY) {
    return { error: "Aplikasi belum punya Partner API key OrderOnline (ORDERONLINE_PARTNER_API_KEY). Daftar sebagai partner OrderOnline dulu." };
  }

  const { supabase, businessId } = await requireContext();
  try {
    await login(token); // validasi token sebelum disimpan
  } catch (e) {
    return { error: errText(e) };
  }

  const { data: existing } = await supabase.from("integrations").select("id").eq("business_id", businessId).eq("type", "orderonline").maybeSingle();
  let integrationId = existing?.id as string | undefined;
  if (integrationId) {
    await supabase.from("integrations").update({ status: "connected" }).eq("id", integrationId);
  } else {
    const { data, error } = await supabase
      .from("integrations")
      .insert({ business_id: businessId, type: "orderonline", name: "OrderOnline" })
      .select("id")
      .single();
    if (error || !data) return { error: "Gagal membuat integrasi." };
    integrationId = data.id as string;
  }

  const admin = createSupabaseAdmin();
  const { error: sErr } = await admin
    .from("integration_secrets")
    .upsert({ integration_id: integrationId, ciphertext: encryptSecret(token) });
  if (sErr) return { error: "Gagal menyimpan token." };

  try {
    const r = await syncOrderOnline(admin, businessId, integrationId);
    revalidatePath("/integrations/orderonline");
    revalidatePath("/templates");
    return { message: `Terhubung. ${r.templates} template diimpor, ${r.rulesAdded} aturan ditambahkan (nonaktif).` };
  } catch (e) {
    await admin.from("integrations").update({ status: "error" }).eq("id", integrationId);
    revalidatePath("/integrations/orderonline");
    return { error: `Token tersimpan, tetapi sinkron gagal: ${errText(e)}` };
  }
}

export async function resyncOrderOnline(): Promise<OOState> {
  const { supabase, businessId } = await requireContext();
  const { data: integ } = await supabase.from("integrations").select("id").eq("business_id", businessId).eq("type", "orderonline").maybeSingle();
  if (!integ) return { error: "OrderOnline belum terhubung." };
  try {
    const r = await syncOrderOnline(createSupabaseAdmin(), businessId, integ.id);
    revalidatePath("/integrations/orderonline");
    revalidatePath("/templates");
    return { message: `Sinkron selesai: ${r.templates} template diperbarui, ${r.rulesAdded} aturan baru.` };
  } catch (e) {
    await createSupabaseAdmin().from("integrations").update({ status: "error" }).eq("id", integ.id);
    revalidatePath("/integrations/orderonline");
    return { error: errText(e) };
  }
}

export async function disconnectOrderOnline(): Promise<OOState> {
  const { supabase, businessId } = await requireContext();
  const { data: integ } = await supabase.from("integrations").select("id").eq("business_id", businessId).eq("type", "orderonline").maybeSingle();
  if (!integ) return {};
  await supabase.from("integrations").update({ status: "disconnected" }).eq("id", integ.id);
  const admin = createSupabaseAdmin(); // integration_secrets & followup_jobs hanya bisa diubah oleh server
  await admin.from("integration_secrets").delete().eq("integration_id", integ.id);
  // Job yang masih menunggu dari integrasi ini tidak boleh terkirim setelah diputus.
  await admin
    .from("followup_jobs")
    .update({ status: "cancelled", error: "integration_disconnected" })
    .eq("business_id", businessId)
    .eq("integration_id", integ.id)
    .eq("status", "pending");
  revalidatePath("/integrations/orderonline");
  return { message: "OrderOnline diputus. Token dihapus dan follow-up yang menunggu dibatalkan." };
}
