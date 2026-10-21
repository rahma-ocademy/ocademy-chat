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
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/page";
import { MessagesSquare, SearchX } from "lucide-react";

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
    <div className="-mx-1 sm:mx-0">
      <h1 className="sr-only">Inbox</h1>
      {/* Baris pertama setinggi layar − top bar (4rem) − padding konten (3rem); tiap panel menggulir sendiri.
          Di bawah 2xl panel detail turun ke baris berikutnya (tinggi bebas). */}
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)] lg:grid-rows-[minmax(560px,calc(100dvh-7rem))] 2xl:grid-cols-[350px_minmax(0,1fr)_300px]">
        <section aria-label="Daftar percakapan" className="card flex max-h-[80dvh] min-h-[420px] flex-col overflow-hidden lg:max-h-none">
          <Toolbar
            filters={f}
            counts={counts}
            userId={user.id}
            agents={ctx.agents.map((a) => ({ id: a.user_id, label: a.email ?? "Agen" }))}
            labels={ctx.labels}
            inboxes={ctx.inboxes.map((i) => ({ id: i.id, name: i.name }))}
          />
          {items.length === 0 ? (
            <div className="flex-1">
              <EmptyState
                icon={f.q ? SearchX : MessagesSquare}
                title={f.q ? "Tidak ditemukan" : "Belum ada percakapan"}
                text={f.q ? `Tidak ada kontak yang cocok dengan “${f.q}”.` : "Percakapan di tab ini akan muncul di sini."}
              />
            </div>
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
                      className={`relative flex gap-3 border-b border-line-soft px-4 py-3 transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-accent ${
                        active ? "bg-brand-soft" : "hover:bg-bg"
                      }`}
                    >
                      {active && <span aria-hidden="true" className="absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-brand" />}
                      <span className="relative">
                        <Avatar name={name} />
                        {c.unread_count > 0 && <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-accent" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className={`truncate text-[15px] ${c.unread_count ? "font-bold text-navy" : "font-semibold text-ink"}`}>{name}</span>
                          <span className={`shrink-0 text-xs ${c.unread_count ? "font-bold text-brand" : "text-muted"}`}>{listTimeLabel(c.last_message_at)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-2">
                          <span className={`line-clamp-1 flex-1 text-[13px] ${c.unread_count ? "font-semibold text-ink" : "text-muted"}`}>{c.last_message_preview ?? "—"}</span>
                          {c.unread_count > 0 && (
                            <span className="min-w-5 rounded-full bg-brand px-1.5 py-0.5 text-center text-[11px] font-bold text-white" aria-label={`${c.unread_count} belum dibaca`}>
                              {c.unread_count}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted">
                          {c.inbox && <span className="rounded-md bg-tint px-1.5 py-0.5 font-semibold">{c.inbox.name}</span>}
                          {c.assignee_id && <span className="rounded-md bg-violet-soft px-1.5 py-0.5 font-semibold text-violet">{agentName(c.assignee_id)}</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Realtime businessId={businessId} />
        </section>

        <section aria-label="Percakapan" className="card flex min-h-[560px] flex-col overflow-hidden lg:min-h-0">
          {detail ? (
            <ThreadView
              conversationId={detail.id}
              unread={detail.unread_count}
              contactName={detail.contact?.name || detail.contact?.phone || "Pengunjung"}
              inboxName={detail.inbox?.name ?? "—"}
              status={detail.status}
              messages={detail.messages.map((m) => ({
                ...m,
                author:
                  m.sender_type === "contact"
                    ? null
                    : m.sender_type === "ai"
                      ? "AI"
                      : m.sender_type === "system"
                        ? "Follow-up otomatis"
                        : m.sender_type === "phone"
                          ? "via HP (WhatsApp Business)"
                          : agentName(m.sender_id),
              }))}
            />
          ) : setup.hasConversation ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState icon={MessagesSquare} title="Pilih percakapan" text="Klik salah satu percakapan di sebelah kiri untuk membaca dan membalas." />
            </div>
          ) : (
            <Onboarding setup={setup} widgetKey={firstLivechat?.widget_key ?? null} />
          )}
        </section>

        {detail && (
          <aside aria-label="Detail percakapan" className="card p-5 lg:col-span-2 2xl:col-span-1 2xl:overflow-y-auto">
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
