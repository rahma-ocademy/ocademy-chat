import type { Metadata } from "next";
import { requireContext } from "@/lib/auth";
import { EmptyState, PageHeader } from "@/components/page";
import { CopyButton } from "@/components/ui";
import { CreateInboxForm, InboxToggle } from "./forms";

export const metadata: Metadata = { title: "Channel" };

const TYPE = { livechat: "Livechat", whatsapp: "WhatsApp", api: "API" } as Record<string, string>;

export default async function InboxesPage() {
  const { supabase, businessId } = await requireContext();
  const { data } = await supabase
    .from("inboxes")
    .select("id, name, type, active, widget_key, created_at")
    .eq("business_id", businessId)
    .order("created_at");
  const inboxes = data ?? [];
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Channel" description="Tempat pesan pelanggan masuk. Mulai dengan livechat; WhatsApp, Instagram, dan Facebook menyusul." />

      <section className="card p-6" aria-labelledby="h-new-inbox">
        <h2 id="h-new-inbox" className="mb-4 text-lg font-bold text-navy">Inbox baru</h2>
        <CreateInboxForm />
      </section>

      <section className="flex flex-col gap-4" aria-label="Daftar inbox">
        {inboxes.length === 0 ? (
          <div className="card"><EmptyState title="Belum ada inbox" text="Buat inbox livechat di atas untuk mulai menerima pesan." /></div>
        ) : (
          inboxes.map((i) => {
            const url = `${base}/w/${i.widget_key}`;
            return (
              <article key={i.id} className="card flex flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[17px] font-bold text-navy">{i.name}</h3>
                    <span className="badge badge-info">{TYPE[i.type] ?? i.type}</span>
                    {!i.active && <span className="badge badge-muted">Nonaktif</span>}
                  </div>
                  <InboxToggle id={i.id} active={i.active} name={i.name} />
                </div>
                {i.type === "livechat" && (
                  <div className="flex flex-col gap-2">
                    <p className="text-sm text-muted">Link widget (bagikan ke pelanggan, atau sematkan di situs Anda):</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line-soft bg-bg px-3 py-2.5 font-mono text-[13px] whitespace-nowrap text-navy">{url}</code>
                      <CopyButton value={url} />
                      <a href={`/w/${i.widget_key}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm">Buka widget uji ↗</a>
                    </div>
                    <details className="text-sm">
                      <summary className="cursor-pointer font-semibold text-navy">Kode sematan (iframe)</summary>
                      <pre className="mt-2 overflow-x-auto rounded-lg bg-[#1E2A4D] p-3 font-mono text-[12px] text-[#E8ECF7]">{`<iframe src="${url}" title="Chat" style="width:380px;height:560px;border:0;border-radius:16px"></iframe>`}</pre>
                    </details>
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
