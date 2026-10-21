"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdmin, requireContext } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { exchangeCode, GraphError, registerPhone, requestCoexSync } from "@/lib/whatsapp/graph";
import { saveWhatsAppConnection, wabaQuotaError } from "@/lib/whatsapp/connect";

export type FormState = { ok?: boolean; error?: string; note?: string };

const ADMIN_ONLY = "Hanya owner/admin yang bisa mengubah platform.";
const uuid = z.string().uuid();
const graphId = z.string().trim().regex(/^\d{5,30}$/, "ID harus berupa angka dari Meta.");

function refresh() {
  revalidatePath("/connected-platforms");
  revalidatePath("/chat");
}

const graphMessage = (e: unknown) =>
  e instanceof GraphError ? `Meta menolak: ${e.message}` : "Gagal menghubungi Meta. Coba lagi sebentar.";

export async function createLivechatInbox(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ name: z.string().trim().min(2, "Nama inbox minimal 2 karakter.").max(60) }).safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  if (!isAdmin(ctx)) return { error: ADMIN_ONLY };
  const { data, error } = await ctx.supabase
    .from("inboxes")
    .insert({ business_id: ctx.businessId, type: "livechat", name: parsed.data.name })
    .select("id")
    .single();
  if (error || !data) return { error: "Gagal membuat inbox." };
  refresh();
  redirect(`/connected-platforms?i=${data.id}`);
}

const settingsSchema = z.object({
  id: uuid,
  name: z.string().trim().min(2, "Nama inbox minimal 2 karakter.").max(60),
  active: z.boolean(),
  aiAgentId: uuid.nullable(),
  members: z.array(uuid).max(200),
});

export async function updateInboxSettings(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = settingsSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    active: formData.get("active") === "on",
    aiAgentId: formData.get("ai_agent_id") || null,
    members: formData.getAll("members"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  if (!isAdmin(ctx)) return { error: ADMIN_ONLY };
  const { supabase, businessId } = ctx;
  const d = parsed.data;

  // RLS + FK komposit memastikan AI agent & anggota milik bisnis yang sama.
  const { data: updated, error } = await supabase
    .from("inboxes")
    .update({ name: d.name, active: d.active, ai_agent_id: d.aiAgentId })
    .eq("id", d.id)
    .eq("business_id", businessId)
    .select("id");
  if (error) return { error: error.code === "23503" ? "AI agent tidak ditemukan." : "Gagal menyimpan pengaturan." };
  if (!updated?.length) return { error: "Inbox tidak ditemukan." };

  const { error: delErr } = await supabase
    .from("inbox_members")
    .delete()
    .eq("inbox_id", d.id)
    .eq("business_id", businessId)
    .not("user_id", "in", `(${d.members.join(",") || "00000000-0000-0000-0000-000000000000"})`);
  const { error: addErr } = d.members.length
    ? await supabase
        .from("inbox_members")
        .upsert(d.members.map((user_id) => ({ inbox_id: d.id, user_id, business_id: businessId })), { onConflict: "inbox_id,user_id", ignoreDuplicates: true })
    : { error: null };
  if (delErr || addErr) return { error: "Pengaturan tersimpan, tapi daftar agen gagal diperbarui." };

  refresh();
  return { ok: true };
}

/** Putuskan WhatsApp: hapus token, nonaktifkan inbox. Riwayat percakapan tetap ada. */
export async function disconnectWhatsApp(id: string): Promise<FormState> {
  if (!uuid.safeParse(id).success) return { error: "Data tidak valid." };
  const ctx = await requireContext();
  if (!isAdmin(ctx)) return { error: ADMIN_ONLY };
  const admin = createSupabaseAdmin();
  const { data } = await admin.from("inboxes").select("id").eq("id", id).eq("business_id", ctx.businessId).eq("type", "whatsapp").maybeSingle();
  if (!data) return { error: "Inbox tidak ditemukan." };
  await admin.from("channel_secrets").delete().eq("inbox_id", id);
  await admin.from("inboxes").update({ active: false, status: "disconnected", status_detail: null }).eq("id", id);
  refresh();
  return { ok: true };
}

/** Coexistence: minta ulang sinkron kontak & riwayat dari app WhatsApp Business. */
export async function retryCoexSync(id: string): Promise<FormState> {
  if (!uuid.safeParse(id).success) return { error: "Data tidak valid." };
  const ctx = await requireContext();
  if (!isAdmin(ctx)) return { error: ADMIN_ONLY };
  const admin = createSupabaseAdmin();
  const { data: inbox } = await admin
    .from("inboxes")
    .select("id, wa_phone_number_id")
    .eq("id", id)
    .eq("business_id", ctx.businessId)
    .eq("connection_mode", "coexistence")
    .maybeSingle();
  const { data: secret } = inbox ? await admin.from("channel_secrets").select("ciphertext").eq("inbox_id", id).maybeSingle() : { data: null };
  if (!inbox || !secret) return { error: "Inbox Coexistence tidak ditemukan atau terputus." };
  const token = decryptSecret(secret.ciphertext as string);
  try {
    await requestCoexSync(token, inbox.wa_phone_number_id as string, "smb_app_state_sync");
    await requestCoexSync(token, inbox.wa_phone_number_id as string, "history");
  } catch (e) {
    return { error: graphMessage(e) };
  }
  await admin.from("inboxes").update({ status_detail: null }).eq("id", id);
  refresh();
  return { ok: true, note: "Sinkron diminta. Kontak dan riwayat chat masuk bertahap lewat webhook." };
}

const embeddedSchema = z.object({
  code: z.string().min(10).max(2000),
  phoneNumberId: graphId,
  wabaId: graphId,
  mode: z.enum(["cloud_api", "coexistence"]),
  pin: z.string().regex(/^\d{6}$/, "PIN harus 6 digit.").optional(),
});

/** Selesai Embedded Signup (Meta): tukar kode → token, verifikasi nomor, langganan webhook, buat inbox. */
export async function connectWhatsAppEmbedded(input: z.input<typeof embeddedSchema>): Promise<FormState & { inboxId?: string }> {
  const parsed = embeddedSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (d.mode === "cloud_api" && !d.pin) return { error: "Isi PIN 6 digit untuk mendaftarkan nomor." };
  const ctx = await requireContext();
  if (!isAdmin(ctx)) return { error: ADMIN_ONLY };
  const admin = createSupabaseAdmin();

  const quota = await wabaQuotaError(admin, ctx.businessId, d.phoneNumberId);
  if (quota) return { error: quota };

  try {
    const token = await exchangeCode(d.code);
    // WABA biasa wajib didaftarkan ke Cloud API; nomor Coexistence sudah aktif di app sehingga tidak didaftarkan.
    if (d.mode === "cloud_api") await registerPhone(token, d.phoneNumberId, d.pin!);
    const res = await saveWhatsAppConnection(admin, { businessId: ctx.businessId, mode: d.mode, phoneNumberId: d.phoneNumberId, wabaId: d.wabaId, token });
    if (!res.ok) return { error: res.error };
    refresh();
    return { ok: true, inboxId: res.inboxId, note: res.note };
  } catch (e) {
    return { error: graphMessage(e) };
  }
}

const manualSchema = z.object({
  name: z.string().trim().max(60).optional(),
  phoneNumberId: graphId,
  wabaId: graphId,
  token: z.string().trim().min(20, "Token terlalu pendek.").max(1000),
});

/** Hubungkan manual dengan token System User (nomor yang sudah terdaftar di Cloud API, mis. nomor uji Meta). */
export async function connectWhatsAppManual(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = manualSchema.safeParse({
    name: formData.get("name") || undefined,
    phoneNumberId: formData.get("phone_number_id"),
    wabaId: formData.get("waba_id"),
    token: formData.get("token"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await requireContext();
  if (!isAdmin(ctx)) return { error: ADMIN_ONLY };
  let res: Awaited<ReturnType<typeof saveWhatsAppConnection>>;
  try {
    res = await saveWhatsAppConnection(createSupabaseAdmin(), { businessId: ctx.businessId, mode: "cloud_api", ...parsed.data });
  } catch (e) {
    return { error: graphMessage(e) };
  }
  if (!res.ok) return { error: res.error };
  refresh();
  redirect(`/connected-platforms?i=${res.inboxId}`);
}
