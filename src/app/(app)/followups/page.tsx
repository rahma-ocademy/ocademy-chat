import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { ArrowRight, Clock, Plus, Send, TriangleAlert, Zap } from "lucide-react";
import { EmptyState, PageHeader, StatCard, sourceBadge } from "@/components/page";
import { eventLabel, formatDelay } from "@/lib/followups/events";
import type { RuleRow } from "@/lib/types";
import { getJobStats } from "@/lib/followups/stats";
import { DeleteRuleButton, RuleToggle } from "./rule-controls";

export const metadata: Metadata = { title: "Follow-up otomatis" };

export default async function FollowupsPage() {
  const { supabase, businessId } = await requireContext();
  const [rules, templates, stats] = await Promise.all([
    supabase.from("followup_rules").select("*").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase.from("followup_templates").select("id, name").eq("business_id", businessId),
    getJobStats(supabase, businessId),
  ]);

  const list = (rules.data ?? []) as RuleRow[];
  const names = new Map((templates.data ?? []).map((t) => [t.id as string, t.name as string]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/followups"
        title="Follow-up otomatis"
        description="Kirim pesan lanjutan otomatis berdasarkan event dari aplikasi ini atau aplikasi pihak ketiga yang terhubung lewat API."
        actions={
          <>
            <Link href="/templates" className="btn btn-secondary">Kelola template</Link>
            <Link href="/followups/new" className="btn btn-primary"><Plus aria-hidden="true" className="size-4" /> Buat follow-up</Link>
          </>
        }
      />

      <section aria-label="Ringkasan" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={Clock} tone="amber" label="Menunggu dikirim" value={stats.pending} />
        <StatCard icon={Send} tone="ok" label="Terkirim" value={stats.sent} hint="24 jam terakhir" />
        <StatCard icon={TriangleAlert} tone="navy" label="Gagal" value={stats.failed} hint="24 jam terakhir" alert={stats.failed > 0} />
      </section>

      <section aria-labelledby="h-rules" className="flex flex-col gap-3">
        <h2 id="h-rules" className="text-lg font-bold text-navy">Aturan follow-up <span className="text-muted">({list.length})</span></h2>
        {list.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Zap}
              tone="amber"
              title="Belum ada aturan follow-up"
              text="Buat aturan pertama Anda, atau hubungkan OrderOnline untuk mengimpor template dan aturan yang sudah ada."
              action={
                <div className="flex flex-wrap justify-center gap-2.5">
                  <Link href="/followups/new" className="btn btn-primary"><Plus aria-hidden="true" className="size-4" /> Buat follow-up</Link>
                  <Link href="/integrations/orderonline" className="btn btn-secondary">Hubungkan OrderOnline</Link>
                </div>
              }
            />
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((r) => {
              const badge = sourceBadge(r.source);
              return (
                <li key={r.id} className={`card flex flex-col gap-4 p-5 transition ${r.active ? "" : "bg-[#FBFCFE]"}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`icon-tile ${r.active ? "tone-amber" : "tone-navy opacity-70"}`}>
                      <Zap aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[16px] font-bold text-navy">{r.name}</h3>
                      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className={badge.cls}>{badge.label}</span>
                        <span>{r.active ? "Aktif" : "Nonaktif"}</span>
                      </p>
                    </div>
                    <RuleToggle id={r.id} active={r.active} label={`Aktifkan ${r.name}`} />
                    <DeleteRuleButton id={r.id} name={r.name} />
                  </div>
                  <ol className="flex flex-wrap items-center gap-2 text-[13px]" aria-label="Alur aturan">
                    <li className="flex items-center gap-2 rounded-xl border border-[#9FDCE4] bg-brand-soft px-3 py-2">
                      <span className="text-[11px] font-bold tracking-[0.06em] text-[#01606A] uppercase">Saat</span>
                      <span className="font-semibold text-navy">{eventLabel(r.trigger_event)}</span>
                      <code className="hidden rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-muted sm:inline">{r.trigger_event}</code>
                    </li>
                    {r.steps.map((st, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <ArrowRight aria-hidden="true" className="size-4 text-muted" />
                        <span className="flex items-center gap-2 rounded-xl border border-line-soft bg-white px-3 py-2 shadow-sm">
                          <span className="flex items-center gap-1 rounded-md bg-amber-soft px-1.5 py-0.5 text-[11px] font-bold text-amber">
                            <Clock aria-hidden="true" className="size-3" /> {formatDelay(st)}
                          </span>
                          <span className="font-medium text-ink">{names.get(st.template_id) ?? "Template dihapus"}</span>
                        </span>
                      </li>
                    ))}
                  </ol>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
