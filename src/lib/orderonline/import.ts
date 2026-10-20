import { convertOrderOnlineBody, extractVariables } from "@/lib/followups/variables";

// Bentuk respons mengikuti dokumentasi Postman OrderOnline Open API (GET /followup-autotext,
// GET /setting/shipping-auto-wa-template). Field yang tidak dikenal diabaikan, bukan ditebak.
type AutotextEntry = {
  enabled?: boolean;
  format?: string;
  format_cod?: string;
  format_instant?: string;
  schedule?: { type?: string; day?: number; hour?: number };
};
export type AutotextMap = Record<string, AutotextEntry>;
export type ShippingMap = Record<string, { enabled?: boolean; format?: string }>;

export type ImportedTemplate = {
  external_ref: string;
  name: string;
  category: string;
  body: string;
  variants: { bank?: string; cod?: string; instant?: string };
  variables: string[];
  /** true bila isi hanya nama preset OrderOnline (mis. "Bank transfer General"), bukan teks pesan. */
  preset: boolean;
};

export type ImportedRule = {
  external_ref: string;
  name: string;
  trigger_event: string;
  delay_minutes: number;
  at_hour?: number;
  stop_events: string[];
  oo_enabled: boolean;
};

const META: Record<string, { name: string; category: string; trigger: string }> = {
  welcome: { name: "Sambutan order", category: "Order", trigger: "order.created" },
  order_confirmation_redirect: { name: "Konfirmasi dari pelanggan", category: "Order", trigger: "order.created" },
  order_detail: { name: "Detail order", category: "Order", trigger: "order.created" },
  follow_up_1: { name: "Follow-up bayar 1", category: "Pembayaran", trigger: "order.created" },
  follow_up_2: { name: "Follow-up bayar 2", category: "Pembayaran", trigger: "order.created" },
  follow_up_3: { name: "Follow-up bayar 3", category: "Pembayaran", trigger: "order.created" },
  follow_up_4: { name: "Follow-up bayar 4", category: "Pembayaran", trigger: "order.created" },
  processing: { name: "Pesanan diproses", category: "Pembayaran", trigger: "order.paid" },
  closing: { name: "Penutup", category: "Order", trigger: "order.completed" },
  cancelled: { name: "Pembatalan", category: "Pembayaran", trigger: "order.cancelled" },
  up_selling: { name: "Up-selling", category: "Penjualan", trigger: "order.completed" },
  manifested: { name: "Resi diserahkan ke kurir", category: "Pengiriman", trigger: "shipping.manifested" },
  problem: { name: "Kendala pengiriman", category: "Pengiriman", trigger: "shipping.problem" },
  inbound: { name: "Paket masuk kota tujuan", category: "Pengiriman", trigger: "shipping.inbound" },
  delivery: { name: "Paket diantar", category: "Pengiriman", trigger: "shipping.delivered" },
};

// Follow-up penagihan berhenti begitu order dibayar atau dibatalkan.
const STOPS_ON_PAYMENT = new Set(["follow_up_1", "follow_up_2", "follow_up_3", "follow_up_4"]);

function toTemplate(key: string, e: AutotextEntry): ImportedTemplate {
  const meta = META[key] ?? { name: key, category: "Lainnya", trigger: "order.created" };
  const body = convertOrderOnlineBody(e.format ?? "");
  const variants = {
    bank: e.format ? convertOrderOnlineBody(e.format) : undefined,
    cod: e.format_cod ? convertOrderOnlineBody(e.format_cod) : undefined,
    instant: e.format_instant ? convertOrderOnlineBody(e.format_instant) : undefined,
  };
  const all = [body, variants.cod ?? "", variants.instant ?? ""].join("\n");
  return {
    external_ref: key,
    name: meta.name,
    category: meta.category,
    body,
    variants,
    variables: extractVariables(all),
    preset: !body.includes("{{"),
  };
}

function toRule(key: string, e: { enabled?: boolean; schedule?: AutotextEntry["schedule"] }): ImportedRule {
  const meta = META[key] ?? { name: key, category: "Lainnya", trigger: "order.created" };
  const fixed = e.schedule?.type === "fixed";
  const day = Math.max(0, Number(e.schedule?.day ?? 0));
  return {
    external_ref: key,
    name: meta.name,
    trigger_event: meta.trigger,
    delay_minutes: fixed ? day * 1440 : 0,
    at_hour: fixed ? Number(e.schedule?.hour ?? 0) : undefined,
    stop_events: STOPS_ON_PAYMENT.has(key) ? ["order.paid", "order.cancelled"] : [],
    oo_enabled: Boolean(e.enabled),
  };
}

export function buildOrderOnlineImport(autotext: AutotextMap, shipping: ShippingMap) {
  const templates: ImportedTemplate[] = [];
  const rules: ImportedRule[] = [];
  for (const [key, e] of Object.entries(autotext)) {
    if (!e || typeof e !== "object") continue;
    templates.push(toTemplate(key, e));
    rules.push(toRule(key, e));
  }
  for (const [key, e] of Object.entries(shipping)) {
    if (!e || typeof e !== "object") continue;
    templates.push(toTemplate(key, { format: e.format, enabled: e.enabled }));
    rules.push(toRule(key, { enabled: e.enabled }));
  }
  return { templates, rules };
}
