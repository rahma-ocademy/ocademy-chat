import "server-only";
import type { Admin } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/plans";
import { saveToken } from "./channel";
import { getPhoneNumber, requestCoexSync, subscribeApp } from "./graph";

export type ConnectInput = {
  businessId: string;
  mode: "cloud_api" | "coexistence";
  phoneNumberId: string;
  wabaId: string;
  token: string;
  name?: string;
};

export type ConnectResult = { ok: true; inboxId: string; note?: string } | { ok: false; error: string };

/** Batas jumlah nomor WhatsApp per paket (plans.limits.waba_count; tidak ada = tanpa batas). */
export async function wabaQuotaError(admin: Admin, businessId: string, phoneNumberId?: string): Promise<string | null> {
  const ent = await getEntitlements(admin, businessId);
  if (!ent) return "Langganan tidak aktif.";
  const limit = ent.limits.waba_count;
  if (limit === undefined) return null;
  let q = admin.from("inboxes").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("type", "whatsapp");
  if (phoneNumberId) q = q.neq("wa_phone_number_id", phoneNumberId); // menyambung ulang nomor yang sama tidak menambah kuota
  const { count } = await q;
  if ((count ?? 0) < limit) return null;
  return limit === 0
    ? `Paket ${ent.planName} tidak termasuk WhatsApp. Upgrade paket untuk menghubungkan nomor.`
    : `Paket ${ent.planName} maksimal ${limit} nomor WhatsApp.`;
}

/**
 * Simpan koneksi WhatsApp yang token-nya sudah didapat: verifikasi nomor ke Meta, langganankan webhook,
 * lalu buat inbox (atau sambungkan ulang inbox lama untuk nomor yang sama di bisnis yang sama).
 */
export async function saveWhatsAppConnection(admin: Admin, input: ConnectInput): Promise<ConnectResult> {
  const quota = await wabaQuotaError(admin, input.businessId, input.phoneNumberId);
  if (quota) return { ok: false, error: quota };

  const info = await getPhoneNumber(input.token, input.phoneNumberId);
  await subscribeApp(input.token, input.wabaId);

  const { data: existing } = await admin
    .from("inboxes")
    .select("id, business_id")
    .eq("wa_phone_number_id", input.phoneNumberId)
    .maybeSingle();
  if (existing && existing.business_id !== input.businessId) {
    return { ok: false, error: "Nomor ini sudah terhubung ke bisnis lain di ocademy chat." };
  }

  const row = {
    business_id: input.businessId,
    type: "whatsapp",
    name: input.name?.trim() || info.verified_name || info.display_phone_number || "WhatsApp",
    connection_mode: input.mode,
    wa_phone_number_id: input.phoneNumberId,
    wa_waba_id: input.wabaId,
    wa_display_phone: info.display_phone_number,
    wa_verified_name: info.verified_name,
    status: "connected",
    status_detail: null as string | null,
    active: true,
    connected_at: new Date().toISOString(),
  };

  let inboxId: string;
  if (existing) {
    const patch: Partial<typeof row> = { ...row };
    delete patch.name; // sambung ulang tidak menimpa nama yang sudah diatur pengguna
    const { error } = await admin.from("inboxes").update(patch).eq("id", existing.id);
    if (error) return { ok: false, error: "Gagal menyimpan inbox." };
    inboxId = existing.id as string;
  } else {
    const { data, error } = await admin.from("inboxes").insert(row).select("id").single();
    if (error || !data) return { ok: false, error: "Gagal membuat inbox." };
    inboxId = data.id as string;
  }
  await saveToken(admin, inboxId, input.token);

  if (input.mode !== "coexistence") return { ok: true, inboxId };

  // Coexistence: minta sinkron kontak & riwayat chat dari app di HP (dikirim Meta lewat webhook).
  const failed: string[] = [];
  for (const t of ["smb_app_state_sync", "history"] as const) {
    await requestCoexSync(input.token, input.phoneNumberId, t).catch(() => failed.push(t));
  }
  if (failed.length) {
    const note = `Sinkron ${failed.join(" & ")} belum berhasil diminta; coba lagi dari pengaturan inbox dalam 24 jam.`;
    await admin.from("inboxes").update({ status_detail: note }).eq("id", inboxId);
    return { ok: true, inboxId, note };
  }
  return { ok: true, inboxId };
}
