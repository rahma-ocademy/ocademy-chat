import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheckBig, FileText, PenLine, Plus, ShoppingBag, TriangleAlert, Webhook, type LucideIcon } from "lucide-react";
import { requireContext } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/page";
import { InfoTip } from "@/components/ui";
import type { Source, TemplateRow } from "@/lib/types";
import { metaStatusView } from "@/lib/whatsapp/template-status-match";
import { ArchiveButton, RefreshStatusButton, TemplateForm } from "./template-form";

export const metadata: Metadata = { title: "Template pesan" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const SOURCE: Record<Source, { label: string; icon: LucideIcon; tone: string }> = {
  app: { label: "Buatan sendiri", icon: PenLine, tone: "tone-brand" },
  orderonline: { label: "OrderOnline", icon: ShoppingBag, tone: "tone-amber" },
  api: { label: "API", icon: Webhook, tone: "tone-navy" },
};

const NEEDS_ATTENTION = new Set(["REJECTED", "PAUSED", "DISABLED", "LIMIT_EXCEEDED", "NOT_FOUND"]);

const FILTERS: { key: string; label: string; match: (t: TemplateRow) => boolean }[] = [
  { key: "", label: "Semua", match: () => true },
  { key: "app", label: "Buatan sendiri", match: (t) => t.source === "app" },
  { key: "orderonline", label: "OrderOnline", match: (t) => t.source === "orderonline" },
  { key: "api", label: "API", match: (t) => t.source === "api" },
  { key: "disetujui", label: "Disetujui Meta", match: (t) => Boolean(t.wa_template_name) && t.wa_status === "APPROVED" },
  { key: "perhatian", label: "Perlu perhatian", match: (t) => Boolean(t.wa_template_name) && NEEDS_ATTENTION.has(t.wa_status ?? "") },
];

const checkedAt = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso)) : null;

export default async function TemplatesPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, businessId } = await requireContext();
  const sp = await searchParams;
  const want = typeof sp.f === "string" ? sp.f : "";
  const { data } = await supabase
    .from("followup_templates")
    .select("*")
    .eq("business_id", businessId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  const all = (data ?? []) as TemplateRow[];
  const filter = FILTERS.find((f) => f.key === want) ?? FILTERS[0];
  const list = all.filter(filter.match);

  const approved = all.filter(FILTERS[4].match).length;
  const attention = all.filter(FILTERS[5].match).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/templates"
        title="Template pesan"
        description="Pesan siap pakai untuk follow-up. Template dari OrderOnline dan API dikelola oleh sumbernya (hanya dibaca di sini)."
        actions={<RefreshStatusButton />}
      />

      <details className="card group overflow-hidden" open={all.length === 0}>
        <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4 transition hover:bg-bg [&::-webkit-details-marker]:hidden">
          <span className="icon-tile icon-tile-sm tone-brand transition group-open:rotate-45">
            <Plus aria-hidden="true" className="size-4" strokeWidth={2.6} />
          </span>
          <span className="text-[17px] font-bold text-navy">Buat template baru</span>
        </summary>
        <div className="border-t border-line-soft p-6"><TemplateForm /></div>
      </details>

      <section aria-labelledby="h-templates" className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
          <h2 id="h-templates" className="text-[17px] font-bold text-navy">
            Daftar template <span className="text-muted">({all.length})</span>
          </h2>
          <p className="flex flex-wrap items-center gap-3 text-[13px] text-muted">
            <span className="flex items-center gap-1.5"><CircleCheckBig aria-hidden="true" className="size-4 text-ok" /> {approved} disetujui Meta</span>
            {attention > 0 && <span className="flex items-center gap-1.5 font-semibold text-bad"><TriangleAlert aria-hidden="true" className="size-4" /> {attention} perlu perhatian</span>}
          </p>
        </div>

        <nav aria-label="Saring template" className="flex flex-wrap gap-1.5 border-b border-line-soft px-5 py-3">
          {FILTERS.map((f) => {
            const on = f.key === filter.key;
            const n = all.filter(f.match).length;
            return (
              <Link key={f.key || "semua"} href={f.key ? `/templates?f=${f.key}` : "/templates"} aria-current={on ? "page" : undefined} className={`chip ${on ? "chip-on" : ""}`}>
                {f.label} <span className={on ? "" : "text-muted"}>{n}</span>
              </Link>
            );
          })}
        </nav>

        {list.length === 0 ? (
          <EmptyState
            icon={FileText}
            tone="sky"
            title={all.length === 0 ? "Belum ada template" : "Tidak ada template di filter ini"}
            text={all.length === 0 ? "Buat template pertama di atas, atau hubungkan OrderOnline untuk mengimpor template yang sudah ada." : "Pilih filter lain untuk melihat template."}
            action={all.length === 0 ? <Link href="/integrations/orderonline" className="btn btn-secondary btn-sm">Hubungkan OrderOnline</Link> : undefined}
          />
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[980px]">
              <thead>
                <tr>
                  <th scope="col">Template</th>
                  <th scope="col">Sumber</th>
                  <th scope="col">Template WhatsApp</th>
                  <th scope="col">
                    <span className="flex items-center gap-1.5">
                      Status Meta
                      <InfoTip label="Apa arti status Meta?">
                        <strong className="block font-bold">Status persetujuan Meta</strong>
                        Di luar 24 jam sejak pelanggan terakhir chat, WhatsApp hanya mengizinkan template yang <strong>Disetujui</strong>.
                        “Teks biasa” = tidak memakai template WhatsApp, hanya terkirim dalam jendela 24 jam. Status diperbarui otomatis
                        lewat webhook, atau klik “Cek status Meta”.
                      </InfoTip>
                    </span>
                  </th>
                  <th scope="col">Isi pesan</th>
                  <th scope="col"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => {
                  const src = SOURCE[t.source] ?? SOURCE.app;
                  const SrcIcon = src.icon;
                  const meta = metaStatusView(t.wa_status, Boolean(t.wa_template_name));
                  const when = checkedAt(t.wa_status_checked_at);
                  return (
                    <tr key={t.id}>
                      <td className="max-w-[220px]">
                        <p className="font-bold text-navy">{t.name}</p>
                        <p className="mt-1 flex flex-wrap gap-1">
                          <span className="badge badge-muted !py-0.5">{t.category}</span>
                          {t.status === "draft" && <span className="badge badge-warn !py-0.5">Draf</span>}
                        </p>
                      </td>
                      <td>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <span className={`icon-tile icon-tile-sm ${src.tone}`}><SrcIcon aria-hidden="true" className="size-4" /></span>
                          <span className="font-semibold text-ink">{src.label}</span>
                        </span>
                      </td>
                      <td>
                        {t.wa_template_name ? (
                          <code className="rounded-md bg-bg px-2 py-1 font-mono text-[12px] text-navy">{t.wa_template_name}</code>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="max-w-[220px]">
                        <span className="flex items-center gap-1.5">
                          <span className={`${meta.cls} whitespace-nowrap`}>{meta.label}</span>
                          <InfoTip label={`Keterangan status ${t.name}`}>
                            {meta.hint}
                            {t.wa_status_reason && <span className="mt-1.5 block"><strong>Alasan Meta:</strong> {t.wa_status_reason}</span>}
                            {when && <span className="mt-1.5 block text-white">Dicek: {when}</span>}
                          </InfoTip>
                        </span>
                      </td>
                      <td className="max-w-sm">
                        <p className="line-clamp-2 text-[13px] text-muted">{t.body || "Isi belum tersedia lewat API OrderOnline (preset)."}</p>
                        {t.variables.length > 0 && (
                          <p className="mt-1.5 flex flex-wrap gap-1" aria-label="Variabel">
                            {t.variables.map((v) => <code key={v} className="rounded-md bg-violet-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold text-violet">{v}</code>)}
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
