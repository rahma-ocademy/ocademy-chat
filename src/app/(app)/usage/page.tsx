import type { Metadata } from "next";
import { requireContext } from "@/lib/auth";
import { PageHeader } from "@/components/page";
import { currentPeriod } from "@/lib/plans";

export const metadata: Metadata = { title: "Usage & paket" };

const FEATURES: Record<string, string> = {
  open_api: "Open API",
  followup: "Follow-up",
  analytics: "Analytics",
  ticketing: "Ticketing",
  flow: "Flow",
  automation: "Automation",
  csat: "CSAT",
  ai_full: "AI Full",
};

export default async function UsagePage() {
  const { supabase, businessId } = await requireContext();
  const period = currentPeriod();

  const [sub, usage, seats] = await Promise.all([
    supabase.from("subscriptions").select("status, plans(id, name, limits, features)").eq("business_id", businessId).maybeSingle(),
    supabase.from("usage_counters").select("key, used").eq("business_id", businessId).eq("period", period),
    supabase.from("memberships").select("user_id", { count: "exact", head: true }).eq("business_id", businessId),
  ]);

  const plan = Array.isArray(sub.data?.plans) ? sub.data.plans[0] : sub.data?.plans;
  const limits = (plan?.limits ?? {}) as Record<string, number>;
  const features = (plan?.features ?? []) as string[];
  const used = new Map((usage.data ?? []).map((u) => [u.key as string, u.used as number]));

  const meters = [
    { label: "Kursi agen", key: "seats", used: seats.count ?? 0, limit: limits.seats, note: "Anggota tim aktif" },
    { label: "Kontak (MAU)", key: "contacts_mau", used: used.get("contacts_mau") ?? 0, limit: limits.contacts_mau, note: "Direset tiap bulan" },
    { label: "Kredit AI", key: "ai_credits", used: used.get("ai_credits") ?? 0, limit: limits.ai_credits, note: "Direset tiap bulan" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Usage & paket" description={`Periode ${period}. Kuota bulanan direset setiap tanggal 1.`} />

      <section className="card flex flex-wrap items-center justify-between gap-4 p-5" aria-label="Paket aktif">
        <div>
          <p className="text-sm text-muted">Paket aktif</p>
          <p className="mt-0.5 text-2xl font-bold text-navy">{plan?.name ?? "Tidak ada paket aktif"}</p>
        </div>
        <p className="flex max-w-xl flex-wrap gap-1.5">
          {features.length === 0 && <span className="text-sm text-muted">Belum ada fitur.</span>}
          {features.map((f) => <span key={f} className="badge badge-info">{FEATURES[f] ?? f}</span>)}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Pemakaian">
        {meters.map((m) => {
          const unlimited = m.limit === undefined;
          const pct = unlimited ? 0 : Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
          const hot = !unlimited && pct >= 90;
          return (
            <div key={m.key} className="card p-5">
              <p className="text-sm text-muted">{m.label}</p>
              <p className="mt-1 text-3xl font-bold text-navy">
                {m.used.toLocaleString("id-ID")}
                <span className="text-base font-medium text-muted"> / {unlimited ? "tanpa batas" : m.limit.toLocaleString("id-ID")}</span>
              </p>
              {!unlimited && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-tint" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${m.label} terpakai`}>
                  <div className={`h-full rounded-full ${hot ? "bg-bad" : "bg-brand"}`} style={{ width: `${pct}%` }} />
                </div>
              )}
              <p className="hint">{m.note}</p>
            </div>
          );
        })}
      </section>

      <p className="text-sm text-muted">Penggantian paket belum tersedia di aplikasi. Untuk sementara, ubah baris <code className="font-mono">subscriptions.plan_id</code> di Supabase.</p>
    </div>
  );
}
