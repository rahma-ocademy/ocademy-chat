import "server-only";
import type { Admin } from "@/lib/supabase/server";
import { optionalEnv } from "@/lib/env";
import { loadToken } from "./channel";
import { GraphError, listMessageTemplates } from "./graph";
import { pickTemplateStatus } from "./template-status-match";

/**
 * Status persetujuan Meta untuk template follow-up yang memakai template WhatsApp (`wa_template_name`).
 * Sumber: Graph API `/{waba-id}/message_templates` (tombol "Cek status Meta") dan webhook
 * `message_template_status_update` (otomatis saat Meta menyetujui/menolak).
 */

export type SyncResult = { ok: true; checked: number; approved: number } | { ok: false; error: string };

export async function syncTemplateStatuses(admin: Admin, businessId: string): Promise<SyncResult> {
  const { data: inboxes } = await admin
    .from("inboxes")
    .select("id, wa_waba_id")
    .eq("business_id", businessId)
    .eq("type", "whatsapp")
    .neq("status", "disconnected")
    .not("wa_waba_id", "is", null);
  if (!inboxes?.length) return { ok: false, error: "Belum ada WhatsApp yang terhubung. Hubungkan WABA di Platform terhubung untuk mengecek status template." };

  const { data: rows } = await admin
    .from("followup_templates")
    .select("id, wa_template_name")
    .eq("business_id", businessId)
    .neq("status", "archived")
    .not("wa_template_name", "is", null);
  if (!rows?.length) return { ok: true, checked: 0, approved: 0 };

  // Satu bisnis bisa punya beberapa nomor di WABA yang sama: ambil per WABA sekali saja.
  const metas = [];
  const seen = new Set<string>();
  let lastError: string | null = null;
  for (const inbox of inboxes) {
    const waba = inbox.wa_waba_id as string;
    if (seen.has(waba)) continue;
    seen.add(waba);
    const token = await loadToken(admin, inbox.id as string).catch(() => null);
    if (!token) {
      lastError = "Token WhatsApp tidak tersedia. Hubungkan ulang inbox WhatsApp.";
      continue;
    }
    try {
      metas.push(...(await listMessageTemplates(token, waba)));
    } catch (e) {
      lastError = e instanceof GraphError ? e.message : "Gagal mengambil template dari Meta.";
    }
  }
  if (metas.length === 0 && lastError) return { ok: false, error: lastError };

  const language = optionalEnv("WHATSAPP_TEMPLATE_LANGUAGE") ?? "id";
  const now = new Date().toISOString();
  let approved = 0;
  for (const row of rows) {
    const hit = pickTemplateStatus(metas, row.wa_template_name as string, language);
    if (hit.status === "APPROVED") approved += 1;
    await admin
      .from("followup_templates")
      .update({ wa_status: hit.status, wa_status_reason: hit.reason, wa_status_checked_at: now })
      .eq("id", row.id);
  }
  return { ok: true, checked: rows.length, approved };
}

/** Webhook `message_template_status_update`: perbarui semua template bisnis pemilik WABA tersebut. */
export async function applyTemplateStatusUpdate(
  admin: Admin,
  ev: { wabaId: string | null; name: string; language: string | null; status: string; reason: string | null },
) {
  if (!ev.wabaId) return 0;
  const { data: owners } = await admin.from("inboxes").select("business_id").eq("wa_waba_id", ev.wabaId);
  const businessIds = [...new Set((owners ?? []).map((o) => o.business_id as string))];
  if (businessIds.length === 0) return 0;
  const language = optionalEnv("WHATSAPP_TEMPLATE_LANGUAGE") ?? "id";
  // Hanya perbarui bila bahasa event sama dengan bahasa yang dipakai aplikasi (atau tidak disebut).
  if (ev.language && !ev.language.toLowerCase().startsWith(language.toLowerCase())) return 0;
  const { data } = await admin
    .from("followup_templates")
    .update({ wa_status: ev.status.toUpperCase(), wa_status_reason: ev.reason, wa_status_checked_at: new Date().toISOString() })
    .in("business_id", businessIds)
    .eq("wa_template_name", ev.name)
    .select("id");
  return data?.length ?? 0;
}
