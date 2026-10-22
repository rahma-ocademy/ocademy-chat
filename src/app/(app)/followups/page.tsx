import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { Clock, Plus, Send, TriangleAlert, Zap } from "lucide-react";
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

      <section aria-labelledby="h-rules" className="card overflow-hidden">
        <div className="border-b border-line-soft px-5 py-4">
          <h2 id="h-rules" className="text-[17px] font-bold text-navy">Aturan follow-up <span className="text-muted">({list.length})</span></h2>
        </div>
        {list.length === 0 ? (
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
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th scope="col">Aturan</th>
                  <th scope="col">Pemicu</th>
                  <th scope="col">Langkah</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const badge = sourceBadge(r.source);
                  return (
                    <tr key={r.id} className={r.active ? "" : "bg-[#FBFCFE]"}>
                      <td className="max-w-[240px]">
                        <p className="font-bold text-navy">{r.name}</p>
                        <p className="mt-1"><span className={`${badge.cls} !py-0.5`}>{badge.label}</span></p>
                      </td>
                      <td>
                        <p className="font-semibold whitespace-nowrap text-navy">{eventLabel(r.trigger_event)}</p>
                        <code className="font-mono text-[11px] text-muted">{r.trigger_event}</code>
                      </td>
                      <td>
                        <ol className="flex flex-col gap-1.5 text-[13px]" aria-label="Langkah">
                          {r.steps.map((st, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <span className="flex items-center gap-1 rounded-md bg-amber-soft px-1.5 py-0.5 text-[11px] font-bold whitespace-nowrap text-amber">
                                <Clock aria-hidden="true" className="size-3" /> {formatDelay(st)}
                              </span>
                              <span className="font-medium text-ink">{names.get(st.template_id) ?? "Template dihapus"}</span>
                            </li>
                          ))}
                        </ol>
                      </td>
                      <td>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <RuleToggle id={r.id} active={r.active} label={`Aktifkan ${r.name}`} />
                          <span className={r.active ? "font-semibold text-ink" : "text-muted"}>{r.active ? "Aktif" : "Nonaktif"}</span>
                        </span>
                      </td>
                      <td className="text-right"><DeleteRuleButton id={r.id} name={r.name} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
