import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { EmptyState, PageHeader, sourceBadge } from "@/components/page";
import { eventLabel, formatDelay } from "@/lib/followups/events";
import type { RuleRow } from "@/lib/types";
import { getJobStats } from "@/lib/followups/stats";
import { DeleteRuleButton, RuleToggle } from "./rule-controls";

export const metadata: Metadata = { title: "Followups" };

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
        title="Followups"
        description="Kirim pesan lanjutan otomatis berdasarkan event dari aplikasi ini atau aplikasi pihak ketiga yang terhubung lewat API."
        actions={
          <>
            <Link href="/templates" className="btn btn-secondary">Kelola template</Link>
            <Link href="/followups/new" className="btn btn-primary">+ Buat follow-up</Link>
          </>
        }
      />

      <section aria-label="Ringkasan" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Menunggu dikirim", value: stats.pending },
          { label: "Terkirim 24 jam terakhir", value: stats.sent },
          { label: "Gagal 24 jam terakhir", value: stats.failed, bad: stats.failed > 0 },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-sm text-muted">{s.label}</p>
            <p className={`mt-1 text-3xl font-bold ${s.bad ? "text-bad" : "text-navy"}`}>{s.value}</p>
          </div>
        ))}
      </section>

      <section className="card overflow-hidden" aria-label="Daftar aturan">
        {list.length === 0 ? (
          <EmptyState
            title="Belum ada aturan follow-up"
            text="Buat aturan pertama Anda, atau hubungkan OrderOnline untuk mengimpor template dan aturan yang sudah ada."
            action={
              <div className="flex flex-wrap justify-center gap-2.5">
                <Link href="/followups/new" className="btn btn-primary">+ Buat follow-up</Link>
                <Link href="/integrations/orderonline" className="btn btn-secondary">Hubungkan OrderOnline</Link>
              </div>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[860px]">
              <thead>
                <tr>
                  <th scope="col">Nama aturan</th>
                  <th scope="col">Pemicu</th>
                  <th scope="col">Template &amp; jeda</th>
                  <th scope="col">Sumber</th>
                  <th scope="col">Aktif</th>
                  <th scope="col"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const badge = sourceBadge(r.source);
                  return (
                    <tr key={r.id}>
                      <td className="font-bold text-navy">{r.name}</td>
                      <td>
                        <code className="rounded-md bg-bg px-2 py-0.5 font-mono text-xs text-navy">{r.trigger_event}</code>
                        <p className="mt-1 text-xs text-muted">{eventLabel(r.trigger_event)}</p>
                      </td>
                      <td>
                        <ul className="flex flex-col gap-1">
                          {r.steps.map((s, i) => (
                            <li key={i} className="text-[13px]">
                              <span className="font-medium">{names.get(s.template_id) ?? "Template dihapus"}</span>
                              <span className="text-muted"> · {formatDelay(s)}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td><span className={badge.cls}>{badge.label}</span></td>
                      <td><RuleToggle id={r.id} active={r.active} label={`Aktifkan ${r.name}`} /></td>
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
