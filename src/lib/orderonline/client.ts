import "server-only";
import { optionalEnv, requireEnv } from "@/lib/env";
import type { AutotextMap, ShippingMap } from "@/lib/orderonline/import";

const base = () => optionalEnv("ORDERONLINE_BASE_URL") ?? "https://open-api.orderonline.id/open-api";

export class OrderOnlineError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit & { accessToken?: string }): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("X-OrderOnline-Partner-Api-Key", requireEnv("ORDERONLINE_PARTNER_API_KEY"));
  headers.set("Accept", "application/json");
  if (init.accessToken) headers.set("Authorization", `Bearer ${init.accessToken}`);

  let res: Response;
  try {
    res = await fetch(`${base()}${path}`, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    throw new OrderOnlineError(`Tidak bisa menghubungi OrderOnline: ${(e as Error).message}`);
  }
  const text = await res.text();
  let json: unknown;
  try { json = JSON.parse(text); } catch { json = undefined; }
  if (!res.ok) {
    const msg = (json as { message?: string } | undefined)?.message ?? `HTTP ${res.status}`;
    throw new OrderOnlineError(`OrderOnline menolak permintaan: ${msg}`, res.status);
  }
  return json as T;
}

type Envelope<T> = { data: T; message?: string; error_code?: number };

/** Tukar Open API Token milik penjual menjadi access token (Bearer). */
export async function login(openApiToken: string) {
  const form = new FormData();
  form.set("token", openApiToken);
  const r = await call<Envelope<{ user_id: string; name: string; email: string; access_token: string }>>("/auth/login", {
    method: "POST",
    body: form,
  });
  return { accessToken: r.data.access_token, userId: r.data.user_id, name: r.data.name };
}

export async function getFollowupAutotext(accessToken: string): Promise<AutotextMap> {
  const r = await call<Envelope<{ follow_up_autotext: AutotextMap }>>("/followup-autotext", { accessToken });
  return r.data.follow_up_autotext ?? {};
}

export async function getShippingTemplates(accessToken: string): Promise<ShippingMap> {
  const r = await call<Envelope<{ value: ShippingMap }>>("/setting/shipping-auto-wa-template", { accessToken });
  return r.data.value ?? {};
}

export async function getWebhooks(accessToken: string) {
  const r = await call<Envelope<{ data?: { _id: string; url: string; scope: string[] }[] }>>("/webhooks", { accessToken });
  return r.data.data ?? [];
}

/**
 * Menandai progres follow-up di order OrderOnline.
 * BELUM TERVERIFIKASI: deskripsi endpoint di dokumentasi publik tertukar dengan /status, jadi isi request
 * ini tebakan. Dimatikan secara default (ORDERONLINE_SYNC_PROGRESS=true untuk mencoba) sampai dikonfirmasi OrderOnline.
 */
export async function markProgress(accessToken: string, submissionId: string, progressKey: string) {
  const form = new FormData();
  form.set(progressKey, "true");
  await call(`/submissions/${encodeURIComponent(submissionId)}/progress`, { method: "PUT", accessToken, body: form });
}
