import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { inboxHref, parseInboxFilters } from "@/lib/inbox/filters";
import { countTabs, getConversation, getInboxContext, getSetupState, listConversations, listTimeLabel } from "@/lib/inbox/queries";
import { Toolbar } from "./toolbar";
import { ThreadView } from "./thread";
import { Details } from "./details";
import { Onboarding } from "./onboarding";
import { Realtime } from "./realtime";

export const metadata: Metadata = { title: "Inbox" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ChatPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, businessId, user } = await requireContext();
  const f = parseInboxFilters(await searchParams);

  const [items, counts, ctx, detail, setup] = await Promise.all([
    listConversations(supabase, businessId, user.id, f),
    countTabs(supabase, businessId, user.id, f),
    getInboxContext(supabase, businessId),
    f.c ? getConversation(supabase, businessId, f.c) : Promise.resolve(null),
    getSetupState(supabase, businessId),
  ]);

  const agentName = (id: string | null) => {
    if (!id) return null;
    if (id === user.id) return "Anda";
    const email = ctx.agents.find((a) => a.user_id === id)?.email;
    return email ? email.split("@")[0] : "Agen";
  };
  const firstLivechat = ctx.inboxes.find((i) => i.type === "livechat" && i.active);

  return (
    <div className="flex flex-col gap-4">
      <Realtime businessId={businessId} />
      <h1 className="sr-only">Inbox</h1>
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)_270px]">
        <section aria-label="Daftar percakapan" className="card flex max-h-[calc(100vh-140px)] min-h-[560px] flex-col overflow-hidden">
          <Toolbar
            filters={f}
            counts={counts}
            userId={user.id}
            agents={ctx.agents.map((a) => ({ id: a.user_id, label: a.email ?? "Agen" }))}
            labels={ctx.labels}
            inboxes={ctx.inboxes.map((i) => ({ id: i.id, name: i.name }))}
          />
          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Tidak ada percakapan di sini.</p>
          ) : (
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {items.map((c) => {
                const name = c.contact.name || c.contact.phone || "Pengunjung";
                const active = f.c === c.id;
                return (
                  <li key={c.id}>
                    <Link
                      href={inboxHref(f, { c: c.id })}
                      aria-current={active ? "page" : undefined}
                      className={`flex gap-3 border-b border-line-soft px-4 py-3 transition ${active ? "bg-brand-soft" : "hover:bg-bg"}`}
                    >
                      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tint font-bold text-navy">
                        {name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate text-[15px] ${c.unread_count ? "font-bold text-navy" : "font-semibold text-ink"}`}>{name}</span>
                          <span className="shrink-0 text-xs text-muted">{listTimeLabel(c.last_message_at)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className="line-clamp-1 flex-1 text-[13px] text-muted">{c.last_message_preview ?? "—"}</span>
                          {c.unread_count > 0 && (
                            <span className="rounded-full bg-brand px-1.5 py-0.5 text-[11px] font-bold text-white" aria-label={`${c.unread_count} belum dibaca`}>
                              {c.unread_count}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted">
                          {c.inbox && <span className="rounded bg-tint px-1.5 py-0.5">{c.inbox.name}</span>}
                          {c.assignee_id && <span className="rounded bg-tint px-1.5 py-0.5">→ {agentName(c.assignee_id)}</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Percakapan" className="card flex max-h-[calc(100vh-140px)] min-h-[560px] flex-col overflow-hidden">
          {detail ? (
            <ThreadView
              conversationId={detail.id}
              unread={detail.unread_count}
              contactName={detail.contact?.name || detail.contact?.phone || "Pengunjung"}
              inboxName={detail.inbox?.name ?? "—"}
              status={detail.status}
              messages={detail.messages.map((m) => ({
                ...m,
                author: m.sender_type === "contact" ? null : m.sender_type === "ai" ? "AI" : m.sender_type === "system" ? "Sistem" : agentName(m.sender_id),
              }))}
            />
          ) : setup.hasConversation ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <p className="text-lg font-bold text-navy">Pilih percakapan</p>
              <p className="text-sm text-muted">Klik salah satu percakapan di sebelah kiri untuk membaca dan membalas.</p>
            </div>
          ) : (
            <Onboarding setup={setup} widgetKey={firstLivechat?.widget_key ?? null} />
          )}
        </section>

        {detail && (
          <aside aria-label="Detail percakapan" className="card p-5 lg:col-span-2 2xl:col-span-1">
            <Details
              conversationId={detail.id}
              status={detail.status}
              assigneeId={detail.assignee_id}
              contact={detail.contact}
              inboxName={detail.inbox?.name ?? "—"}
              agents={ctx.agents.map((a) => ({ id: a.user_id, label: a.user_id === user.id ? `${a.email ?? "Saya"} (Anda)` : a.email ?? "Agen" }))}
              labels={detail.labels}
              allLabels={ctx.labels}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
