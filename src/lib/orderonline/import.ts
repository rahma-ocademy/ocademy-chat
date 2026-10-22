import { createHash } from "node:crypto";
import type { Condition } from "@/lib/followups/conditions";
import { convertOrderOnlineBody, extractVariables } from "@/lib/followups/variables";

// Sumber: field `follow_up_autotext` di tiap produk (GET /v1/products). Template global & template
// pengiriman hanya ada di Open API lama yang butuh partner key, jadi tidak diimpor.
// Field yang tidak dikenal diabaikan, bukan ditebak.
type AutotextEntry = {
  enabled?: boolean;
  format?: string;
  format_cod?: string;
  format_instant?: string;
  schedule?: { type?: string; day?: number; hour?: number };
};
export type AutotextMap = Record<string, AutotextEntry>;
export type OrderOnlineProduct = { _id: string; name: string; follow_up_autotext?: AutotextMap };

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
  template_ref: string;
  /** Aturan hanya berlaku untuk order produk-produk ini (kondisi `product_ids in [...]`). */
  conditions: Condition[];
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

const digest = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 10);
const productLabel = (names: string[], total: number) => {
  if (total > 1 && names.length === total) return "semua produk";
  const first = names[0].length > 40 ? `${names[0].slice(0, 39)}…` : names[0];
  return names.length > 1 ? `${first} +${names.length - 1} produk` : first;
};

function toRule(key: string, e: AutotextEntry) {
  const meta = META[key] ?? { name: key, category: "Lainnya", trigger: "order.created" };
  const fixed = e.schedule?.type === "fixed";
  const day = Math.max(0, Number(e.schedule?.day ?? 0));
  return {
    name: meta.name,
    trigger_event: meta.trigger,
    delay_minutes: fixed ? day * 1440 : 0,
    at_hour: fixed ? Number(e.schedule?.hour ?? 0) : undefined,
    stop_events: STOPS_ON_PAYMENT.has(key) ? ["order.paid", "order.cancelled"] : [],
  };
}

/**
 * Template follow-up OrderOnline diatur per produk. Teks yang identik di banyak produk digabung jadi satu
 * template; aturan dibuat per (template + jadwal) dan dibatasi ke produk-produknya lewat kondisi.
 * Hanya entri yang aktif di OrderOnline dan berisi teks yang diimpor.
 * external_ref = "<kunci>:<hash isi>" (template) dan "<kunci>:<hash isi>:<hash jadwal>" (aturan): stabil antar-sinkron,
 * dan bagian sebelum ":" pertama tetap kunci progres OrderOnline (welcome, follow_up_1, …).
 */
export function buildOrderOnlineImport(products: OrderOnlineProduct[]) {
  const templates = new Map<string, ImportedTemplate & { key: string; products: string[] }>();
  const rules = new Map<string, ImportedRule & { product_ids: string[]; products: string[] }>();

  for (const p of products) {
    for (const [key, e] of Object.entries(p.follow_up_autotext ?? {})) {
      if (!e || typeof e !== "object" || !e.enabled || !e.format?.trim()) continue;
      const t = toTemplate(key, e);
      const tRef = `${key}:${digest([t.body, t.variants])}`;
      const tpl = templates.get(tRef) ?? { ...t, external_ref: tRef, key, products: [] };
      tpl.products.push(p.name);
      templates.set(tRef, tpl);

      const r = toRule(key, e);
      const rRef = `${tRef}:${digest([r.delay_minutes, r.at_hour ?? null])}`;
      const rule = rules.get(rRef) ?? { ...r, external_ref: rRef, template_ref: tRef, conditions: [], product_ids: [], products: [] };
      rule.product_ids.push(p._id);
      rule.products.push(p.name);
      rules.set(rRef, rule);
    }
  }

  // Nama template diberi label produk hanya bila satu kunci punya lebih dari satu versi teks.
  const versions = new Map<string, number>();
  for (const t of templates.values()) versions.set(t.key, (versions.get(t.key) ?? 0) + 1);

  return {
    templates: [...templates.values()].map(({ key, products: names, ...t }) => ({
      ...t,
      name: (versions.get(key) ?? 0) > 1 ? `${t.name} · ${productLabel(names, products.length)}` : t.name,
    })),
    rules: [...rules.values()].map(({ product_ids, products: names, ...r }) => ({
      ...r,
      name: `${r.name} · ${productLabel(names, products.length)}`,
      conditions: [{ field: "product_ids", op: "in" as const, values: product_ids }],
    })),
  };
}
