import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Parser webhook WhatsApp Cloud API (Meta) — murni, tanpa I/O, diuji.
 * Field yang dipetakan: `messages` (pesan masuk + status kirim) dan `smb_message_echoes`
 * (Coexistence: pesan yang dikirim bisnis dari app WhatsApp Business di HP). Field lain
 * (mis. `history`, `smb_app_state_sync`) dikembalikan sebagai `other` agar disimpan mentah.
 */

export type WaEvent =
  | { kind: "message"; phoneNumberId: string; waId: string; profileName: string | null; id: string; timestamp: string; body: string }
  | { kind: "echo"; phoneNumberId: string; to: string; id: string; timestamp: string; body: string }
  | { kind: "status"; phoneNumberId: string; id: string; status: "sent" | "delivered" | "read" | "failed"; error: string | null }
  | { kind: "other"; phoneNumberId: string | null; wabaId: string | null; field: string; value: unknown };

/** Verifikasi header X-Hub-Signature-256 (HMAC-SHA256 body mentah dengan App Secret). */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const want = Buffer.from(createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"));
  const got = Buffer.from(header.slice(7));
  return got.length === want.length && timingSafeEqual(got, want);
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const MAX_BODY = 4096;
const clip = (s: string) => (s.length > MAX_BODY ? `${s.slice(0, MAX_BODY - 1)}…` : s);

/** Ubah satu objek pesan WhatsApp (jenis apa pun) menjadi teks yang bisa ditampilkan di inbox. */
export function messageText(m: Obj): string {
  const type = str(m.type) ?? "unknown";
  const part = obj(m[type]);
  const caption = str(part?.caption);
  switch (type) {
    case "text":
      return clip(str(part?.body) ?? "");
    case "image":
      return clip(caption ? `[Gambar] ${caption}` : "[Gambar]");
    case "video":
      return clip(caption ? `[Video] ${caption}` : "[Video]");
    case "document":
      return clip(`[Dokumen] ${caption ?? str(part?.filename) ?? ""}`.trim());
    case "audio":
      return "[Pesan suara]";
    case "sticker":
      return "[Stiker]";
    case "location": {
      const where = [str(part?.name), str(part?.address)].filter(Boolean).join(", ");
      return clip(where ? `[Lokasi] ${where}` : "[Lokasi]");
    }
    case "contacts":
      return "[Kontak]";
    case "reaction":
      return `[Reaksi] ${str(part?.emoji) ?? ""}`.trim();
    case "button":
      return clip(str(part?.text) ?? "[Tombol]");
    case "interactive": {
      const reply = obj(part?.button_reply) ?? obj(part?.list_reply);
      return clip(str(reply?.title) ?? "[Balasan interaktif]");
    }
    default:
      return "[Pesan tidak didukung]";
  }
}

const STATUSES = new Set(["sent", "delivered", "read", "failed"]);

export function parseWebhook(payload: unknown): WaEvent[] {
  const root = obj(payload);
  if (!root || root.object !== "whatsapp_business_account") return [];
  const events: WaEvent[] = [];

  for (const e of arr(root.entry)) {
    const entry = obj(e);
    const wabaId = str(entry?.id);
    for (const c of arr(entry?.changes)) {
      const change = obj(c);
      const field = str(change?.field) ?? "unknown";
      const value = obj(change?.value);
      const phoneNumberId = str(obj(value?.metadata)?.phone_number_id);

      if (field === "messages" && value && phoneNumberId) {
        const names = new Map<string, string>();
        for (const ct of arr(value.contacts)) {
          const contact = obj(ct);
          const waId = str(contact?.wa_id);
          const name = str(obj(contact?.profile)?.name);
          if (waId && name) names.set(waId, name);
        }
        for (const raw of arr(value.messages)) {
          const m = obj(raw);
          const id = str(m?.id);
          const from = str(m?.from);
          if (!m || !id || !from) continue;
          events.push({ kind: "message", phoneNumberId, waId: from, profileName: names.get(from) ?? null, id, timestamp: str(m.timestamp) ?? "", body: messageText(m) || "[Pesan kosong]" });
        }
        for (const raw of arr(value.statuses)) {
          const s = obj(raw);
          const id = str(s?.id);
          const status = str(s?.status);
          if (!id || !status || !STATUSES.has(status)) continue;
          const err = obj(arr(s?.errors)[0]);
          const detail = err ? [err.code != null ? String(err.code) : null, str(err.title), str(obj(err.error_data)?.details)].filter(Boolean).join(" · ") : null;
          events.push({ kind: "status", phoneNumberId, id, status: status as "sent" | "delivered" | "read" | "failed", error: detail || null });
        }
        continue;
      }

      if (field === "smb_message_echoes" && value && phoneNumberId) {
        for (const raw of arr(value.message_echoes)) {
          const m = obj(raw);
          const id = str(m?.id);
          const to = str(m?.to);
          if (!m || !id || !to) continue;
          events.push({ kind: "echo", phoneNumberId, to, id, timestamp: str(m.timestamp) ?? "", body: messageText(m) || "[Pesan kosong]" });
        }
        continue;
      }

      events.push({ kind: "other", phoneNumberId, wabaId, field, value: change?.value ?? null });
    }
  }
  return events;
}

/** Timestamp WhatsApp (detik unix, string) → ISO; jatuh ke `now` bila tidak valid. */
export function waTime(ts: string, now = new Date()): string {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : now.toISOString();
}
