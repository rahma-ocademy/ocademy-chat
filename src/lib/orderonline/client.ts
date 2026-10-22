import "server-only";
import { optionalEnv } from "@/lib/env";
import type { OrderOnlineProduct } from "@/lib/orderonline/import";

// Tanpa partner key. Satu host (api-master.orderonline.id), https://developers.orderonline.id/reference:
// - Login: POST /v1/auth — Personal Access Token → JWT, lalu JWT dipakai sebagai Bearer.
// - Template follow-up: field `follow_up_autotext` di GET /v1/products.
// - Webhook & progres: path Open API lama di /open-api (butuh partner key; tidak dipakai di alur utama).
const base = () => optionalEnv("ORDERONLINE_BASE_URL") ?? "https://api-master.orderonline.id";

export class OrderOnlineError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

async function call<T>(url: string, init: RequestInit & { accessToken?: string }): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.accessToken) headers.set("Authorization", `Bearer ${init.accessToken}`);

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
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

/** Tukar Personal Access Token milik penjual menjadi JWT (Bearer). 400 = token salah atau akun nonaktif. */
export async function login(personalAccessToken: string) {
  const r = await call<Envelope<{ user_id: string; name: string; email: string; username: string; access_token: string }>>(`${base()}/v1/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: personalAccessToken }),
  });
  return { accessToken: r.data.access_token, userId: r.data.user_id, name: r.data.name };
}

/** Semua produk penjual (maks 1000 per halaman), termasuk `follow_up_autotext` per produk. */
export async function listProducts(accessToken: string): Promise<OrderOnlineProduct[]> {
  const all: OrderOnlineProduct[] = [];
  for (let page = 1; page <= 50; page++) {
    const r = await call<Envelope<{ products?: OrderOnlineProduct[]; page_info?: { last_page?: number } }>>(
      `${base()}/v1/products?limit=1000&page=${page}`,
      { accessToken },
    );
    all.push(...(r.data.products ?? []));
    if (page >= (r.data.page_info?.last_page ?? 1)) break;
  }
  return all;
}

export async function getWebhooks(accessToken: string) {
  const r = await call<Envelope<{ data?: { _id: string; url: string; scope: string[] }[] }>>(`${base()}/open-api/webhooks`, { accessToken });
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
  await call(`${base()}/open-api/submissions/${encodeURIComponent(submissionId)}/progress`, { method: "PUT", accessToken, body: form });
}
