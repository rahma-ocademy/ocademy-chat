import type { Metadata } from "next";
import { requireContext } from "@/lib/auth";
import { Bot, Check, Crown, Lock, UserRound, Users } from "lucide-react";
import { Notice, PageHeader } from "@/components/page";
import { ALL_FEATURES, currentPeriod, planEnforced } from "@/lib/plans";

export const metadata: Metadata = { title: "Paket & pemakaian" };

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
  // Selama pembatasan paket dimatikan (lib/plans.ts), tampilkan apa yang benar-benar berlaku: semua fitur, tanpa batas.
  const enforced = planEnforced();
  const limits = (enforced ? (plan?.limits ?? {}) : {}) as Record<string, number>;
  const features = (enforced ? (plan?.features ?? []) : ALL_FEATURES) as string[];
  const used = new Map((usage.data ?? []).map((u) => [u.key as string, u.used as number]));

  const meters = [
    { label: "Kursi agen", key: "seats", used: seats.count ?? 0, limit: limits.seats, note: "Anggota tim aktif", icon: Users, tone: "rose" },
    { label: "Kontak (MAU)", key: "contacts_mau", used: used.get("contacts_mau") ?? 0, limit: limits.contacts_mau, note: "Direset tiap bulan", icon: UserRound, tone: "sky" },
    { label: "Kredit AI", key: "ai_credits", used: used.get("ai_credits") ?? 0, limit: limits.ai_credits, note: "Direset tiap bulan", icon: Bot, tone: "violet" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader nav="/usage" title="Paket & pemakaian" description={`Periode ${period}. Kuota bulanan direset setiap tanggal 1.`} />

      {!enforced && (
        <Notice tone="info">
          Pembatasan paket sedang dimatikan: semua fitur terbuka dan kuota tanpa batas. Aktifkan lagi dengan env <code className="font-mono">PLAN_ENFORCEMENT=on</code>.
        </Notice>
      )}

      <section className="hero flex flex-wrap items-center justify-between gap-6" aria-label="Paket aktif">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
            <Crown aria-hidden="true" className="size-7" />
          </span>
          <div>
            <p className="text-sm font-semibold text-white">Paket aktif</p>
            <p className="text-[28px] leading-tight font-bold">{enforced ? (plan?.name ?? "Tidak ada paket aktif") : "Semua fitur dibuka"}</p>
            <p className="text-sm text-white">Periode {period}</p>
          </div>
        </div>
        <ul className="flex max-w-xl flex-wrap gap-2" aria-label="Fitur paket">
          {features.length === 0 && <li className="text-sm text-white">Belum ada fitur.</li>}
          {features.map((f) => (
            <li key={f} className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[13px] font-semibold ring-1 ring-white/25">
              <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> {FEATURES[f] ?? f}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-4 md:grid-cols-3" aria-label="Pemakaian">
        {meters.map((m) => {
          const unlimited = m.limit === undefined;
          const pct = unlimited ? 0 : Math.min(100, Math.round((m.used / Math.max(1, m.limit)) * 100));
          const level = pct >= 90 ? "bg-bad" : pct >= 70 ? "bg-[#E0A100]" : "bg-brand-gradient";
          const Icon = m.icon;
          return (
            <div key={m.key} className="card flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className={`icon-tile tone-${m.tone}`}>
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <p className="font-semibold text-navy">{m.label}</p>
                {!unlimited && <span className={`ml-auto text-sm font-bold ${pct >= 90 ? "text-bad" : "text-muted"}`}>{pct}%</span>}
              </div>
              <p className="text-3xl font-bold text-navy">
                {m.used.toLocaleString("id-ID")}
                <span className="text-base font-medium text-muted"> / {unlimited ? "tanpa batas" : m.limit.toLocaleString("id-ID")}</span>
              </p>
              {!unlimited && (
                <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${m.label} terpakai`}>
                  <span className={level} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              )}
              <p className="text-[13px] text-muted">{m.note}</p>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="h-features" className="card p-6">
        <h2 id="h-features" className="mb-4 text-[17px] font-bold text-navy">Fitur per paket</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {Object.entries(FEATURES).map(([key, label]) => {
            const on = features.includes(key);
            return (
              <li key={key} className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm ${on ? "border-[#BFE5D8] bg-ok-soft font-semibold text-ok" : "border-line-soft text-muted"}`}>
                {on ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : <Lock aria-hidden="true" className="size-4" />}
                {label}
                <span className="sr-only">{on ? "(termasuk)" : "(tidak termasuk)"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-sm text-muted">Penggantian paket belum tersedia di aplikasi. Untuk sementara, ubah baris <code className="font-mono">subscriptions.plan_id</code> di Supabase.</p>
    </div>
  );
}
