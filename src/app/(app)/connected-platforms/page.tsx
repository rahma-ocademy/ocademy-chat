import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin, requireContext } from "@/lib/auth";
import { ExternalLink, Globe, MousePointerClick, Plus, RadioTower, Search, Smartphone, Webhook } from "lucide-react";
import { EmptyState, Notice, PageHeader } from "@/components/page";
import { CopyButton } from "@/components/ui";
import { INBOX_TYPE_LABEL, MODE_LABEL, STATUS_BADGE } from "@/lib/platforms";
import { InboxSettingsForm, WhatsAppControls } from "./forms";

export const metadata: Metadata = { title: "Platform terhubung" };

const TYPE_LOOK = {
  whatsapp: { icon: Smartphone, tone: "tone-ok" },
  livechat: { icon: Globe, tone: "tone-sky" },
  api: { icon: Webhook, tone: "tone-navy" },
} as const;
const look = (type: string) => TYPE_LOOK[type as keyof typeof TYPE_LOOK] ?? TYPE_LOOK.api;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

type InboxRow = {
  id: string;
  name: string;
  type: string;
  active: boolean;
  status: string;
  status_detail: string | null;
  connection_mode: string | null;
  wa_display_phone: string | null;
  wa_verified_name: string | null;
  wa_waba_id: string | null;
  widget_key: string;
  ai_agent_id: string | null;
  connected_at: string | null;
};

export default async function ConnectedPlatformsPage({ searchParams }: { searchParams: SearchParams }) {
  const ctx = await requireContext();
  const { supabase, businessId } = ctx;
  const sp = await searchParams;
  const q = first(sp.q).trim().slice(0, 60);
  const selectedId = first(sp.i);

  const [inboxesRes, agentsRes, membersRes] = await Promise.all([
    supabase
      .from("inboxes")
      .select("id, name, type, active, status, status_detail, connection_mode, wa_display_phone, wa_verified_name, wa_waba_id, widget_key, ai_agent_id, connected_at")
      .eq("business_id", businessId)
      .order("created_at"),
    supabase.from("ai_agents").select("id, name").eq("business_id", businessId).order("created_at"),
    supabase.from("memberships").select("user_id, email, name, role").eq("business_id", businessId).eq("status", "active").order("created_at"),
  ]);
  const all = (inboxesRes.data ?? []) as InboxRow[];
  const needle = q.toLowerCase();
  const inboxes = needle ? all.filter((i) => i.name.toLowerCase().includes(needle) || (i.wa_display_phone ?? "").includes(needle)) : all;
  const selected = all.find((i) => i.id === selectedId) ?? null;

  const { data: memberRows } = selected
    ? await supabase.from("inbox_members").select("user_id").eq("inbox_id", selected.id)
    : { data: [] };
  const assigned = new Set((memberRows ?? []).map((m) => m.user_id as string));
  const admin = isAdmin(ctx);
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/connected-platforms"
        title="Platform terhubung"
        description="Hubungkan WhatsApp dan livechat, lalu atur agen yang menangani tiap inbox."
        actions={admin ? <Link href="/connected-platforms/new" className="btn btn-primary"><Plus aria-hidden="true" className="size-4" /> Inbox baru</Link> : undefined}
      />

      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <section aria-label="Daftar inbox" className="card flex flex-col overflow-hidden">
          <form role="search" className="relative border-b border-line-soft p-3">
            <label htmlFor="inbox-q" className="sr-only">Cari inbox</label>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-6 size-4 -translate-y-1/2 text-muted" />
            <input id="inbox-q" name="q" type="search" defaultValue={q} className="field !min-h-10 !pl-9 !text-sm" placeholder="Cari nama atau nomor…" />
          </form>
          {inboxes.length === 0 ? (
            <EmptyState
              icon={q ? Search : RadioTower}
              tone={q ? "navy" : "ok"}
              title={q ? "Tidak ditemukan" : "Belum ada inbox"}
              text={q ? `Tidak ada inbox yang cocok dengan "${q}".` : "Hubungkan WhatsApp atau buat livechat untuk mulai menerima pesan."}
              action={!q && admin ? <Link href="/connected-platforms/new" className="btn btn-secondary btn-sm">Buat inbox</Link> : undefined}
            />
          ) : (
            <ul>
              {inboxes.map((i) => {
                const current = i.id === selected?.id;
                const st = STATUS_BADGE[i.status] ?? STATUS_BADGE.connected;
                const L = look(i.type);
                return (
                  <li key={i.id}>
                    <Link
                      href={`/connected-platforms?${new URLSearchParams({ ...(q ? { q } : {}), i: i.id })}`}
                      aria-current={current ? "page" : undefined}
                      className={`relative flex items-center gap-3 border-b border-line-soft px-4 py-3 transition ${current ? "bg-brand-soft" : "hover:bg-bg"}`}
                    >
                      {current && <span aria-hidden="true" className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-brand" />}
                      <span className={`icon-tile ${L.tone} ${i.active ? "" : "opacity-60"}`}>
                        <L.icon aria-hidden="true" className="size-5" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate font-semibold text-navy">{i.name}</span>
                        {!i.active ? <span className="badge badge-muted">Nonaktif</span> : i.status !== "connected" ? <span className={st.cls}>{st.label}</span> : null}
                      </span>
                      <span className="text-[13px] text-muted">
                        {INBOX_TYPE_LABEL[i.type] ?? i.type}
                        {i.connection_mode ? ` · ${MODE_LABEL[i.connection_mode]}` : ""}
                        {i.wa_display_phone ? ` · ${i.wa_display_phone}` : ""}
                      </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Pengaturan inbox" className="card p-6">
          {!selected ? (
            <EmptyState icon={MousePointerClick} title="Belum ada inbox dipilih" text="Pilih inbox di sebelah kiri untuk melihat dan mengatur pengaturannya." />
          ) : (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-3">
                {(() => {
                  const L = look(selected.type);
                  return (
                    <span className={`icon-tile icon-tile-lg ${L.tone}`}>
                      <L.icon aria-hidden="true" className="size-6" />
                    </span>
                  );
                })()}
                <h2 className="text-xl font-bold text-navy">{selected.name}</h2>
                <span className="badge badge-info">{INBOX_TYPE_LABEL[selected.type] ?? selected.type}</span>
                {selected.type === "whatsapp" && <span className={(STATUS_BADGE[selected.status] ?? STATUS_BADGE.connected).cls}>{(STATUS_BADGE[selected.status] ?? STATUS_BADGE.connected).label}</span>}
              </div>

              {!admin && <Notice tone="info">Anda bisa melihat pengaturan inbox. Hanya owner/admin yang bisa mengubahnya.</Notice>}
              {selected.status_detail && <Notice tone="warn">{selected.status_detail}</Notice>}

              {selected.type === "whatsapp" && (
                <div className="flex flex-col gap-3">
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-muted">Nomor</dt><dd className="font-semibold text-navy">{selected.wa_display_phone ?? "—"}</dd></div>
                    <div><dt className="text-muted">Nama terverifikasi</dt><dd className="font-semibold text-navy">{selected.wa_verified_name ?? "—"}</dd></div>
                    <div><dt className="text-muted">Mode</dt><dd className="font-semibold text-navy">{MODE_LABEL[selected.connection_mode ?? ""] ?? "—"}</dd></div>
                    <div><dt className="text-muted">WABA ID</dt><dd className="font-mono text-[13px] text-navy">{selected.wa_waba_id ?? "—"}</dd></div>
                  </dl>
                  {selected.connection_mode === "coexistence" && (
                    <p className="text-sm text-muted">
                      Balasan yang Anda kirim dari app WhatsApp Business di HP juga muncul di inbox, ditandai <strong>“via HP”</strong>.
                    </p>
                  )}
                  {admin && <WhatsAppControls id={selected.id} coexistence={selected.connection_mode === "coexistence"} connected={selected.status !== "disconnected"} />}
                </div>
              )}

              {selected.type === "livechat" && (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted">Link widget (bagikan ke pelanggan, atau sematkan di situs Anda):</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line-soft bg-bg px-3 py-2.5 font-mono text-[13px] whitespace-nowrap text-navy">{`${base}/w/${selected.widget_key}`}</code>
                    <CopyButton value={`${base}/w/${selected.widget_key}`} />
                    <a href={`/w/${selected.widget_key}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm">Buka widget uji <ExternalLink aria-hidden="true" className="size-4" /></a>
                  </div>
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-navy">Kode sematan (iframe)</summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-[#1E2A4D] p-3 font-mono text-[12px] text-[#E8ECF7]">{`<iframe src="${base}/w/${selected.widget_key}" title="Chat" style="width:380px;height:560px;border:0;border-radius:16px"></iframe>`}</pre>
                  </details>
                </div>
              )}

              <InboxSettingsForm
                key={selected.id}
                readOnly={!admin}
                inbox={{ id: selected.id, name: selected.name, active: selected.active, aiAgentId: selected.ai_agent_id }}
                aiAgents={(agentsRes.data ?? []) as { id: string; name: string }[]}
                members={((membersRes.data ?? []) as { user_id: string; email: string | null; name: string | null; role: string }[]).map((m) => ({
                  id: m.user_id,
                  label: m.name || m.email || "Anggota",
                  checked: assigned.has(m.user_id),
                }))}
              />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
