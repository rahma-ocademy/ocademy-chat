import type { Metadata } from "next";
import { requireContext } from "@/lib/auth";
import { EmptyState, PageHeader, sourceBadge } from "@/components/page";
import type { TemplateRow } from "@/lib/types";
import { ArchiveButton, TemplateForm } from "./template-form";

export const metadata: Metadata = { title: "Template" };

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
      <PageHeader title="Template" description="Pesan siap pakai untuk follow-up. Template dari OrderOnline dan API dikelola oleh sumbernya (hanya dibaca di sini)." />

      <details className="card p-6" open={list.length === 0}>
        <summary className="cursor-pointer text-[17px] font-bold text-navy">+ Buat template baru</summary>
        <div className="mt-5"><TemplateForm /></div>
      </details>

      <section className="card overflow-hidden" aria-label="Daftar template">
        {list.length === 0 ? (
          <EmptyState title="Belum ada template" text="Buat template pertama di atas, atau hubungkan OrderOnline untuk mengimpor template yang sudah ada." />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[820px]">
              <thead>
                <tr><th scope="col">Nama</th><th scope="col">Kategori</th><th scope="col">Sumber</th><th scope="col">Isi pesan</th><th scope="col"><span className="sr-only">Aksi</span></th></tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const b = sourceBadge(t.source);
                  return (
                    <tr key={t.id}>
                      <td className="font-bold text-navy">{t.name}{t.status === "draft" && <span className="badge badge-warn ml-2">Draf</span>}</td>
                      <td>{t.category}</td>
                      <td><span className={b.cls}>{b.label}</span></td>
                      <td className="max-w-md">
                        <p className="line-clamp-2 text-[13px] text-muted">
                          {t.body || "Isi belum tersedia lewat API OrderOnline (preset)."}
                        </p>
                        {t.variables.length > 0 && (
                          <p className="mt-1.5 flex flex-wrap gap-1">
                            {t.variables.map((v) => <code key={v} className="rounded bg-bg px-1.5 py-0.5 font-mono text-[11px] text-navy">{v}</code>)}
                          </p>
                        )}
                      </td>
                      <td className="text-right"><ArchiveButton id={t.id} name={t.name} /></td>
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
