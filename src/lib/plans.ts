import "server-only";
import type { Admin } from "@/lib/supabase/server";

export type Feature = "open_api" | "followup" | "analytics" | "ticketing" | "flow" | "automation" | "csat" | "ai_full";
export type LimitKey = "seats" | "contacts_mau" | "ai_credits" | "waba_count";

export type Entitlements = {
  planId: string;
  planName: string;
  limits: Partial<Record<LimitKey, number>>; // kunci tidak ada = tanpa batas
  features: string[];
};

export async function getEntitlements(admin: Admin, businessId: string): Promise<Entitlements | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("status, plans(id, name, limits, features)")
    .eq("business_id", businessId)
    .maybeSingle();
  const plan = Array.isArray(data?.plans) ? data?.plans[0] : data?.plans;
  if (!data || data.status !== "active" || !plan) return null;
  return { planId: plan.id, planName: plan.name, limits: plan.limits ?? {}, features: plan.features ?? [] };
}

export const can = (e: Entitlements | null, feature: Feature) => Boolean(e?.features.includes(feature));

export const currentPeriod = (d = new Date()) => d.toISOString().slice(0, 7); // YYYY-MM (UTC)

/** Potong kuota secara atomik di database. false = kuota habis. */
export async function consume(admin: Admin, businessId: string, key: LimitKey, n: number, e: Entitlements | null) {
  const limit = e?.limits[key] ?? null;
  const { data, error } = await admin.rpc("consume_usage", {
    p_business: businessId,
    p_key: key,
    p_period: currentPeriod(),
    p_n: n,
    p_limit: limit,
  });
  if (error) throw error;
  return data === true;
}
