import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createSupabaseAdmin, type Admin } from "@/lib/supabase/server";
import { apiError, parseJson } from "@/lib/http";
import { sha256Hex } from "@/lib/crypto";
import { normalizePhone } from "@/lib/phone";
import { cancelOnReply } from "@/lib/followups/engine";

/**
 * API publik widget livechat. Tanpa login: pengunjung dikenali lewat token acak (header X-Visitor-Token)
 * yang hanya disimpan di browsernya; database hanya menyimpan hash-nya (contacts.external_id).
 * Belum ada rate limiting — pasang di depan (CDN/edge) sebelum dipublikasikan luas.
 */

const TOKEN = /^[a-f0-9]{48}$/;
const KEY = /^[a-f0-9]{32}$/;

type Inbox = { id: string; business_id: string; name: string; type: string; active: boolean };

/** null = tidak ada/nonaktif (404); "unavailable" = database bermasalah (503, widget boleh mencoba lagi). */
async function findInbox(admin: Admin, key: string): Promise<Inbox | null | "unavailable"> {
  if (!KEY.test(key)) return null;
  const { data, error } = await admin.from("inboxes").select("id, business_id, name, type, active").eq("widget_key", key).maybeSingle();
  if (error) return "unavailable";
  return data && data.type === "livechat" && data.active ? (data as Inbox) : null;
}

const notAvailable = (inbox: null | "unavailable") =>
  inbox === "unavailable"
    ? apiError(503, "unavailable", "Layanan sementara tidak tersedia. Coba lagi sebentar.")
    : apiError(404, "not_found", "Chat tidak tersedia.");

const externalId = (token: string) => `lc:${sha256Hex(token)}`;

export async function GET(req: Request, ctx: RouteContext<"/api/public/livechat/[key]">) {
  const { key } = await ctx.params;
  const admin = createSupabaseAdmin();
  const inbox = await findInbox(admin, key);
  if (!inbox || inbox === "unavailable") return notAvailable(inbox);

  const token = req.headers.get("x-visitor-token") ?? "";
  if (!TOKEN.test(token)) return NextResponse.json({ data: { inbox_name: inbox.name, messages: [] } });

  const { data: contact } = await admin.from("contacts").select("id").eq("business_id", inbox.business_id).eq("external_id", externalId(token)).maybeSingle();
  if (!contact) return NextResponse.json({ data: { inbox_name: inbox.name, messages: [] } });

  const { data: convs } = await admin.from("conversations").select("id").eq("contact_id", contact.id).eq("inbox_id", inbox.id);
  const ids = (convs ?? []).map((c) => c.id as string);
  const { data: msgs } = ids.length
    ? await admin
        .from("messages")
        .select("id, direction, sender_type, body, created_at")
        .in("conversation_id", ids)
        .eq("is_private", false) // catatan internal tidak pernah keluar ke pelanggan
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };

  return NextResponse.json({
    data: {
      inbox_name: inbox.name,
      messages: (msgs ?? []).reverse().map((m) => ({
        id: m.id,
        from: m.direction === "in" ? "me" : m.sender_type === "ai" ? "ai" : "agent",
        body: m.body,
        created_at: m.created_at,
      })),
    },
  });
}

const postSchema = z.object({
  name: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(32).optional(),
  message: z.string().trim().min(1, "Pesan kosong.").max(2000, "Pesan maksimal 2000 karakter."),
});

export async function POST(req: Request, ctx: RouteContext<"/api/public/livechat/[key]">) {
  const { key } = await ctx.params;
  const admin = createSupabaseAdmin();
  const inbox = await findInbox(admin, key);
  if (!inbox || inbox === "unavailable") return notAvailable(inbox);

  const body = await parseJson(req, postSchema);
  if (!body.ok) return body.res;
  const phone = body.data.phone ? normalizePhone(body.data.phone) : undefined;
  if (body.data.phone && !phone) return apiError(422, "invalid_phone", "Nomor telepon tidak valid.");

  const given = req.headers.get("x-visitor-token") ?? "";
  const token = TOKEN.test(given) ? given : randomBytes(24).toString("hex");
  const ext = externalId(token);

  // Kontak: buat bila baru; perbarui nama/telepon hanya bila dikirim.
  let { data: contact } = await admin.from("contacts").select("id, phone").eq("business_id", inbox.business_id).eq("external_id", ext).maybeSingle();
  if (!contact) {
    const { data, error } = await admin
      .from("contacts")
      .insert({ business_id: inbox.business_id, external_id: ext, name: body.data.name || null, phone: phone ?? null })
      .select("id, phone")
      .single();
    if (error || !data) return apiError(500, "internal", "Gagal menyimpan kontak.");
    contact = data;
  } else if (body.data.name || phone) {
    await admin.from("contacts").update({ ...(body.data.name ? { name: body.data.name } : {}), ...(phone ? { phone } : {}) }).eq("id", contact.id);
    if (phone) contact.phone = phone;
  }

  // Percakapan: pakai yang terakhir untuk kontak ini di inbox ini (trigger membuka lagi bila sudah selesai).
  let { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("contact_id", contact.id)
    .eq("inbox_id", inbox.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!conv) {
    const { data, error } = await admin
      .from("conversations")
      .insert({ business_id: inbox.business_id, inbox_id: inbox.id, contact_id: contact.id })
      .select("id")
      .single();
    if (error || !data) return apiError(500, "internal", "Gagal membuat percakapan.");
    conv = data;
  }

  const { error: mErr } = await admin.from("messages").insert({
    business_id: inbox.business_id,
    conversation_id: conv.id,
    direction: "in",
    sender_type: "contact",
    body: body.data.message,
    status: "received",
  });
  if (mErr) return apiError(500, "internal", "Gagal mengirim pesan.");

  // Pelanggan membalas → follow-up yang menunggu (aturan stop-on-reply) dihentikan.
  if (contact.phone) await cancelOnReply(admin, inbox.business_id, contact.phone).catch(() => 0);

  return NextResponse.json({ data: { visitor_token: token } }, { status: 201 });
}
