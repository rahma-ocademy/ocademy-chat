"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sendWhatsApp, type WaInbox } from "@/lib/whatsapp/channel";

export type ChatResult = { ok: true } | { ok: false; error: string };

const id = z.string().uuid();
const fail = (error: string): ChatResult => ({ ok: false, error });

/** Ambil percakapan milik bisnis aktif (RLS + filter eksplisit). */
async function load(conversationId: string) {
  const ctx = await requireContext();
  const { data } = await ctx.supabase
    .from("conversations")
    .select("id, assignee_id, status, contacts(phone), inboxes(id, business_id, type, active, status, wa_phone_number_id, connection_mode)")
    .eq("id", conversationId)
    .eq("business_id", ctx.businessId)
    .maybeSingle();
  return { ...ctx, conv: data };
}

export async function sendMessage(conversationId: string, body: string, isPrivate: boolean): Promise<ChatResult> {
  const parsed = z.object({ id, body: z.string().trim().min(1, "Pesan kosong.").max(4096, "Pesan terlalu panjang.") }).safeParse({ id: conversationId, body });
  if (!parsed.success) return fail(parsed.error.issues[0].message);

  const { supabase, businessId, user, conv } = await load(conversationId);
  if (!conv) return fail("Percakapan tidak ditemukan.");

  const inbox = (Array.isArray(conv.inboxes) ? conv.inboxes[0] : conv.inboxes) as
    | (WaInbox & { type: string; active: boolean; status: string })
    | null;
  const contact = (Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts) as { phone: string | null } | null;
  // Livechat: widget mengambil pesan langsung dari database. WhatsApp: dikirim langsung lewat Cloud API.
  // Kanal lain (api): masuk antrean keluar untuk diambil sistem pemanggil.
  const viaWhatsApp = !isPrivate && inbox?.type === "whatsapp";
  const viaOutbox = !isPrivate && !viaWhatsApp && inbox?.type !== "livechat";
  if (viaWhatsApp && (!inbox.active || inbox.status !== "connected")) return fail("Inbox WhatsApp ini tidak aktif atau terputus. Cek di Platform.");
  if (viaWhatsApp && !contact?.phone) return fail("Kontak ini tidak punya nomor WhatsApp.");

  const { data: msg, error } = await supabase
    .from("messages")
    .insert({
      business_id: businessId,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "agent",
      sender_id: user.id,
      is_private: isPrivate,
      body: parsed.data.body,
      status: viaOutbox || viaWhatsApp ? "queued" : "sent",
    })
    .select("id")
    .single();
  if (error || !msg) return fail("Pesan gagal dikirim.");

  let sendError: string | null = null;
  if (viaWhatsApp) {
    // Agen tidak boleh mengubah baris pesan (RLS); status hasil kirim ditulis server.
    const admin = createSupabaseAdmin();
    const out = await sendWhatsApp(admin, inbox, contact!.phone!, { text: parsed.data.body });
    await admin
      .from("messages")
      .update(out.ok ? { status: "sent", external_id: out.externalId || null } : { status: "failed", error: out.error })
      .eq("id", msg.id);
    if (!out.ok) sendError = out.error;
  }

  if (viaOutbox) {
    await createSupabaseAdmin()
      .from("outbox_messages")
      .insert({ business_id: businessId, channel: inbox?.type ?? "whatsapp", to_phone: contact?.phone ?? null, body: parsed.data.body });
  }

  // Membalas percakapan yang belum di-assign = mengambilnya. Membuka percakapan = membacanya.
  const patch: Record<string, unknown> = { unread_count: 0 };
  if (!isPrivate && !conv.assignee_id) patch.assignee_id = user.id;
  await supabase.from("conversations").update(patch).eq("id", conversationId).eq("business_id", businessId);

  revalidatePath("/chat");
  return sendError ? fail(sendError) : { ok: true };
}

export async function assignConversation(conversationId: string, assigneeId: string | null): Promise<ChatResult> {
  if (!id.safeParse(conversationId).success || (assigneeId !== null && !id.safeParse(assigneeId).success)) return fail("Data tidak valid.");
  const { supabase, businessId, conv } = await load(conversationId);
  if (!conv) return fail("Percakapan tidak ditemukan.");

  if (assigneeId) {
    const { count } = await supabase
      .from("memberships")
      .select("user_id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("user_id", assigneeId)
      .eq("status", "active");
    if (!count) return fail("Agen bukan anggota aktif bisnis ini.");
  }
  const { error } = await supabase.from("conversations").update({ assignee_id: assigneeId }).eq("id", conversationId).eq("business_id", businessId);
  if (error) return fail("Gagal menyimpan.");
  revalidatePath("/chat");
  return { ok: true };
}

export async function setConversationStatus(conversationId: string, status: "open" | "resolved"): Promise<ChatResult> {
  if (!id.safeParse(conversationId).success || !["open", "resolved"].includes(status)) return fail("Data tidak valid.");
  const { supabase, businessId, user, conv } = await load(conversationId);
  if (!conv) return fail("Percakapan tidak ditemukan.");
  const patch =
    status === "resolved"
      ? { status, resolved_at: new Date().toISOString(), resolved_by: user.id, unread_count: 0 }
      : { status, resolved_at: null, resolved_by: null };
  const { error } = await supabase.from("conversations").update(patch).eq("id", conversationId).eq("business_id", businessId);
  if (error) return fail("Gagal menyimpan.");
  revalidatePath("/chat");
  return { ok: true };
}

export async function addLabel(conversationId: string, name: string): Promise<ChatResult> {
  const parsed = z.object({ id, name: z.string().trim().min(1, "Nama label kosong.").max(40, "Nama label maksimal 40 karakter.") }).safeParse({ id: conversationId, name });
  if (!parsed.success) return fail(parsed.error.issues[0].message);
  const { supabase, businessId, conv } = await load(conversationId);
  if (!conv) return fail("Percakapan tidak ditemukan.");

  const { data: label, error } = await supabase
    .from("labels")
    .upsert({ business_id: businessId, name: parsed.data.name }, { onConflict: "business_id,name" })
    .select("id")
    .single();
  if (error || !label) return fail("Gagal membuat label.");

  const { error: linkErr } = await supabase
    .from("conversation_labels")
    .upsert({ conversation_id: conversationId, label_id: label.id, business_id: businessId }, { onConflict: "conversation_id,label_id", ignoreDuplicates: true });
  if (linkErr) return fail("Gagal menambahkan label.");
  revalidatePath("/chat");
  return { ok: true };
}

export async function removeLabel(conversationId: string, labelId: string): Promise<ChatResult> {
  if (!id.safeParse(conversationId).success || !id.safeParse(labelId).success) return fail("Data tidak valid.");
  const { supabase, businessId } = await requireContext();
  await supabase.from("conversation_labels").delete().eq("conversation_id", conversationId).eq("label_id", labelId).eq("business_id", businessId);
  revalidatePath("/chat");
  return { ok: true };
}

export async function markRead(conversationId: string): Promise<ChatResult> {
  if (!id.safeParse(conversationId).success) return fail("Data tidak valid.");
  const { supabase, businessId } = await requireContext();
  await supabase.from("conversations").update({ unread_count: 0 }).eq("id", conversationId).eq("business_id", businessId).gt("unread_count", 0);
  revalidatePath("/chat");
  return { ok: true };
}
