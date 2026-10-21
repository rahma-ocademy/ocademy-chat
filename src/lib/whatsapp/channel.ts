import "server-only";
import type { Admin } from "@/lib/supabase/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { cancelOnReply } from "@/lib/followups/engine";
import { GraphError, OUTSIDE_WINDOW, sendTemplate, sendText } from "./graph";
import { waTime, type WaEvent } from "./webhook";
import { applyTemplateStatusUpdate } from "./template-status";

/**
 * Jembatan WhatsApp ↔ database: menyimpan pesan masuk/echo/status dari webhook dan mengirim pesan keluar.
 * Semua lewat klien service role (dipanggil dari webhook, worker, atau server action setelah cek akses).
 */

export type WaInbox = { id: string; business_id: string; wa_phone_number_id: string; connection_mode: "cloud_api" | "coexistence" };

const INBOX_COLS = "id, business_id, wa_phone_number_id, connection_mode";

export async function saveToken(admin: Admin, inboxId: string, token: string) {
  const { error } = await admin
    .from("channel_secrets")
    .upsert({ inbox_id: inboxId, ciphertext: encryptSecret(token), updated_at: new Date().toISOString() });
  if (error) throw new Error(`Gagal menyimpan token: ${error.message}`);
}

export async function loadToken(admin: Admin, inboxId: string): Promise<string | null> {
  const { data } = await admin.from("channel_secrets").select("ciphertext").eq("inbox_id", inboxId).maybeSingle();
  return data ? decryptSecret(data.ciphertext as string) : null;
}

/** Inbox WhatsApp aktif & terhubung milik bisnis (dipakai worker follow-up). */
export async function findSendingInbox(admin: Admin, businessId: string): Promise<WaInbox | null> {
  const { data } = await admin
    .from("inboxes")
    .select(INBOX_COLS)
    .eq("business_id", businessId)
    .eq("type", "whatsapp")
    .eq("active", true)
    .eq("status", "connected")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return (data as WaInbox | null) ?? null;
}

export type SendOutcome = { ok: true; externalId: string } | { ok: false; error: string; outsideWindow: boolean };

/** Kirim teks, atau template bila diberikan. Tidak melempar: kegagalan dikembalikan sebagai alasan. */
export async function sendWhatsApp(
  admin: Admin,
  inbox: WaInbox,
  to: string,
  message: { text: string } | { template: string; language: string; params: string[] },
): Promise<SendOutcome> {
  const token = await loadToken(admin, inbox.id).catch(() => null);
  if (!token) return { ok: false, error: "Token WhatsApp tidak tersedia. Hubungkan ulang inbox.", outsideWindow: false };
  try {
    const externalId =
      "text" in message
        ? await sendText(token, inbox.wa_phone_number_id, to, message.text)
        : await sendTemplate(token, inbox.wa_phone_number_id, to, message.template, message.language, message.params);
    return { ok: true, externalId };
  } catch (e) {
    const outsideWindow = e instanceof GraphError && e.code === OUTSIDE_WINDOW;
    const error = outsideWindow
      ? "Di luar jendela 24 jam WhatsApp: pelanggan harus membalas dulu, atau kirim template yang disetujui Meta."
      : (e as Error).message;
    if (e instanceof GraphError && (e.status === 401 || e.code === 190)) {
      await admin.from("inboxes").update({ status: "error", status_detail: "Token kedaluwarsa/dicabut. Hubungkan ulang." }).eq("id", inbox.id);
    }
    return { ok: false, error: error.slice(0, 500), outsideWindow };
  }
}

/** Kontak + percakapan untuk nomor WhatsApp di inbox ini (dibuat bila belum ada). */
export async function ensureConversation(admin: Admin, inbox: Pick<WaInbox, "id" | "business_id">, waId: string, name: string | null) {
  const phone = normalizePhone(waId) ?? waId;
  const ext = `wa:${phone}`;
  let { data: contact } = await admin.from("contacts").select("id, name").eq("business_id", inbox.business_id).eq("external_id", ext).maybeSingle();
  if (!contact) {
    const { data, error } = await admin
      .from("contacts")
      .upsert({ business_id: inbox.business_id, external_id: ext, phone, name }, { onConflict: "business_id,external_id" })
      .select("id, name")
      .single();
    if (error || !data) throw new Error(`Gagal menyimpan kontak: ${error?.message}`);
    contact = data;
  } else if (name && !contact.name) {
    await admin.from("contacts").update({ name }).eq("id", contact.id);
  }

  const { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("inbox_id", inbox.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (conv) return { conversationId: conv.id as string, phone };
  const { data: created, error } = await admin
    .from("conversations")
    .insert({ business_id: inbox.business_id, inbox_id: inbox.id, contact_id: contact.id })
    .select("id")
    .single();
  if (error || !created) throw new Error(`Gagal membuat percakapan: ${error?.message}`);
  return { conversationId: created.id as string, phone };
}

export type ApplySummary = { messages: number; echoes: number; statuses: number; stored: number; unknownNumber: number };

/** Terapkan event webhook. Idempoten: pesan dengan wamid yang sama tidak disimpan dua kali. */
export async function applyEvents(admin: Admin, events: WaEvent[]): Promise<ApplySummary> {
  const summary: ApplySummary = { messages: 0, echoes: 0, statuses: 0, stored: 0, unknownNumber: 0 };
  const inboxes = new Map<string, (WaInbox & { active: boolean }) | null>();
  const inboxFor = async (phoneNumberId: string | null) => {
    if (!phoneNumberId) return null;
    if (!inboxes.has(phoneNumberId)) {
      const { data } = await admin.from("inboxes").select(`${INBOX_COLS}, active`).eq("wa_phone_number_id", phoneNumberId).maybeSingle();
      inboxes.set(phoneNumberId, (data as (WaInbox & { active: boolean }) | null) ?? null);
    }
    return inboxes.get(phoneNumberId) ?? null;
  };

  for (const ev of events) {
    // Event template milik WABA (bukan nomor tertentu): tidak butuh inbox.
    if (ev.kind === "template_status") {
      await applyTemplateStatusUpdate(admin, ev);
      continue;
    }
    const inbox = await inboxFor(ev.phoneNumberId);
    if (!inbox) {
      summary.unknownNumber += 1;
      continue;
    }

    if (ev.kind === "message" || ev.kind === "echo") {
      const incoming = ev.kind === "message";
      // Inbox nonaktif: pesan tetap disimpan (tidak hilang), hanya tidak dibalas otomatis.
      const { conversationId, phone } = await ensureConversation(admin, inbox, incoming ? ev.waId : ev.to, incoming ? ev.profileName : null);
      const { error } = await admin.from("messages").upsert(
        {
          business_id: inbox.business_id,
          conversation_id: conversationId,
          direction: incoming ? "in" : "out",
          sender_type: incoming ? "contact" : "phone",
          body: ev.body,
          status: incoming ? "received" : "sent",
          external_id: ev.id,
          created_at: waTime(ev.timestamp),
        },
        { onConflict: "business_id,external_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(`Gagal menyimpan pesan: ${error.message}`);
      if (incoming) {
        summary.messages += 1;
        await cancelOnReply(admin, inbox.business_id, phone).catch(() => 0);
      } else {
        summary.echoes += 1;
      }
      continue;
    }

    if (ev.kind === "status") {
      // Status hanya maju (sent → delivered → read); 'failed' selalu dicatat.
      const order = ["queued", "sent", "delivered", "read"];
      const { data: msg } = await admin.from("messages").select("id, status").eq("business_id", inbox.business_id).eq("external_id", ev.id).maybeSingle();
      if (msg && (ev.status === "failed" || order.indexOf(ev.status) > order.indexOf(msg.status as string))) {
        await admin.from("messages").update({ status: ev.status, error: ev.error }).eq("id", msg.id);
      }
      summary.statuses += 1;
      continue;
    }

    await admin.from("channel_webhook_events").insert({ business_id: inbox.business_id, inbox_id: inbox.id, field: ev.field, payload: ev.value as object });
    summary.stored += 1;
  }
  return summary;
}
