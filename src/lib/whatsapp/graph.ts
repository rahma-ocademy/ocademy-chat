import "server-only";
import { optionalEnv } from "@/lib/env";

/**
 * Klien minimal WhatsApp Cloud API (Meta Graph API).
 * Dipakai untuk: menukar kode Embedded Signup, berlangganan webhook WABA, mendaftarkan nomor
 * (WABA biasa), meminta sinkron Coexistence, dan mengirim pesan.
 */

export const graphVersion = () => optionalEnv("META_GRAPH_VERSION") ?? "v23.0";
const base = () => `https://graph.facebook.com/${graphVersion()}`;

/** Konfigurasi Meta App untuk Embedded Signup. null = belum diisi (tombol connect menampilkan penjelasan). */
export function metaConfig() {
  const appId = optionalEnv("META_APP_ID");
  const appSecret = optionalEnv("META_APP_SECRET");
  const configId = optionalEnv("META_ES_CONFIG_ID");
  return appId && appSecret && configId ? { appId, appSecret, configId } : null;
}

export class GraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: number | null,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: { method?: string; token?: string; body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
  const url = new URL(`${base()}/${path}`);
  for (const [k, v] of Object.entries(init.query ?? {})) url.searchParams.set(k, v);
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method ?? "GET",
      headers: {
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
        ...(init.body ? { "content-type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new GraphError(`Tidak bisa menghubungi Meta: ${(e as Error).message}`, 0, null);
  }
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; error_user_msg?: string } } & T;
  if (!res.ok || json.error) {
    const e = json.error ?? {};
    throw new GraphError(e.error_user_msg ?? e.message ?? `Meta mengembalikan HTTP ${res.status}`, res.status, e.code ?? null);
  }
  return json;
}

/** Tukar `code` dari Embedded Signup menjadi business integration token. */
export async function exchangeCode(code: string): Promise<string> {
  const cfg = metaConfig();
  if (!cfg) throw new GraphError("Meta App belum dikonfigurasi.", 0, null);
  const r = await call<{ access_token?: string }>("oauth/access_token", {
    query: { client_id: cfg.appId, client_secret: cfg.appSecret, code },
  });
  if (!r.access_token) throw new GraphError("Meta tidak mengembalikan access token.", 0, null);
  return r.access_token;
}

export type PhoneInfo = { display_phone_number: string | null; verified_name: string | null };

export async function getPhoneNumber(token: string, phoneNumberId: string): Promise<PhoneInfo> {
  const r = await call<{ display_phone_number?: string; verified_name?: string }>(encodeURIComponent(phoneNumberId), {
    token,
    query: { fields: "display_phone_number,verified_name" },
  });
  return { display_phone_number: r.display_phone_number ?? null, verified_name: r.verified_name ?? null };
}

/** Langganankan app kita ke webhook WABA (tanpa ini pesan masuk tidak dikirim ke kita). */
export const subscribeApp = (token: string, wabaId: string) =>
  call<{ success?: boolean }>(`${encodeURIComponent(wabaId)}/subscribed_apps`, { method: "POST", token });

/** WABA biasa (bukan Coexistence): daftarkan nomor ke Cloud API dengan PIN 2 langkah 6 digit. */
export const registerPhone = (token: string, phoneNumberId: string, pin: string) =>
  call<{ success?: boolean }>(`${encodeURIComponent(phoneNumberId)}/register`, {
    method: "POST",
    token,
    body: { messaging_product: "whatsapp", pin },
  });

/**
 * Coexistence: minta Meta mengirim kontak (`smb_app_state_sync`) dan riwayat chat (`history`) dari app
 * WhatsApp Business lewat webhook. Menurut dokumentasi Meta harus diminta dalam 24 jam setelah onboarding.
 */
export const requestCoexSync = (token: string, phoneNumberId: string, syncType: "smb_app_state_sync" | "history") =>
  call<{ request_id?: string }>(`${encodeURIComponent(phoneNumberId)}/smb_app_data`, {
    method: "POST",
    token,
    body: { messaging_product: "whatsapp", sync_type: syncType },
  });

type SendResult = { messages?: { id: string }[] };

export async function sendText(token: string, phoneNumberId: string, to: string, body: string): Promise<string> {
  const r = await call<SendResult>(`${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    token,
    body: { messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { preview_url: false, body } },
  });
  return r.messages?.[0]?.id ?? "";
}

/** Template pesan yang sudah disetujui Meta — wajib untuk memulai percakapan di luar jendela 24 jam. */
export async function sendTemplate(token: string, phoneNumberId: string, to: string, name: string, language: string, params: string[]): Promise<string> {
  const r = await call<SendResult>(`${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    token,
    body: {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(params.length ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] } : {}),
      },
    },
  });
  return r.messages?.[0]?.id ?? "";
}

/** Kode error Meta yang artinya "di luar jendela 24 jam, pakai template". */
export const OUTSIDE_WINDOW = 131047;
