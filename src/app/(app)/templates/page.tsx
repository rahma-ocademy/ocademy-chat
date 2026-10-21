import type { Metadata } from "next";
import { requireContext } from "@/lib/auth";
import { FileText, Plus } from "lucide-react";
import { EmptyState, PageHeader, sourceBadge } from "@/components/page";
import type { TemplateRow } from "@/lib/types";
import { ArchiveButton, TemplateForm } from "./template-form";

export const metadata: Metadata = { title: "Template pesan" };

export default async function TemplatesPage() {
  const { supabase, businessId } = await requireContext();
  const { data } = await supabase
    .from("followup_templates")
    .select("*")
    .eq("business_id", businessId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  const list = (data ?? []) as TemplateRow[];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader nav="/templates" title="Template pesan" description="Pesan siap pakai untuk follow-up. Template dari OrderOnline dan API dikelola oleh sumbernya (hanya dibaca di sini)." />

      <details className="card group overflow-hidden" open={list.length === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 transition hover:bg-bg [&::-webkit-details-marker]:hidden">
          <span className="icon-tile icon-tile-sm tone-brand transition group-open:rotate-45">
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
          </span>
          <span className="text-[17px] font-bold text-navy">Buat template baru</span>
        </summary>
        <div className="border-t border-line-soft p-6"><TemplateForm /></div>
      </details>

      <section aria-labelledby="h-templates" className="flex flex-col gap-3">
        <h2 id="h-templates" className="text-lg font-bold text-navy">Template <span className="text-muted">({list.length})</span></h2>
        {list.length === 0 ? (
          <div className="card">
            <EmptyState icon={FileText} tone="sky" title="Belum ada template" text="Buat template pertama di atas, atau hubungkan OrderOnline untuk mengimpor template yang sudah ada." />
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => {
              const b = sourceBadge(t.source);
              return (
                <li key={t.id} className="card flex flex-col gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <span className="icon-tile tone-sky">
                      <FileText aria-hidden="true" className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-bold text-navy">{t.name}</h3>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className={b.cls}>{b.label}</span>
                        <span className="badge badge-muted">{t.category}</span>
                        {t.status === "draft" && <span className="badge badge-warn">Draf</span>}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl rounded-tl-sm border border-[#BFE6EA] bg-[#E2F5F7] px-3.5 py-2.5">
                    <p className="line-clamp-4 text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
                      {t.body || "Isi belum tersedia lewat API OrderOnline (preset)."}
                    </p>
                  </div>
                  {t.variables.length > 0 && (
                    <p className="flex flex-wrap gap-1" aria-label="Variabel">
                      {t.variables.map((v) => <code key={v} className="rounded-md bg-violet-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold text-violet">{v}</code>)}
                    </p>
                  )}
                  <div className="mt-auto flex justify-end border-t border-line-soft pt-3"><ArchiveButton id={t.id} name={t.name} /></div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
