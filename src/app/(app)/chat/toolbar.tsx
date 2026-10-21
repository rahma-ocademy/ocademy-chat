"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { inboxHref, type InboxFilters, type InboxTab } from "@/lib/inbox/filters";

type Option = { id: string; label: string };

export function Toolbar({
  filters: f,
  counts,
  userId,
  agents,
  labels,
  inboxes,
}: {
  filters: InboxFilters;
  counts: Record<InboxTab, number>;
  userId: string;
  agents: Option[];
  labels: { id: string; name: string }[];
  inboxes: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(f.q);
  const go = (patch: Partial<InboxFilters>) => router.push(inboxHref(f, { ...patch, c: null }));
  const activeFilters = Number(Boolean(f.inbox)) + Number(Boolean(f.label));

  const tabs: { key: InboxTab; label: string }[] = [
    { key: "assigned", label: "Assigned" },
    { key: "unassigned", label: "Unassigned" },
    { key: "resolved", label: "Resolved" },
  ];

  return (
    <div className="flex flex-col gap-3 border-b border-line-soft p-3">
      <div className="flex items-center gap-2">
        <label htmlFor="agent-filter" className="sr-only">Filter agen</label>
        <select id="agent-filter" className="field !min-h-10 flex-1 !text-sm" value={f.agent} onChange={(e) => go({ agent: e.target.value })}>
          <option value="all">Semua agen</option>
          <option value="me">Saya</option>
          {agents.filter((a) => a.id !== userId).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <button
          type="button"
          className={`btn btn-sm !px-2.5 ${f.unread ? "btn-outline" : "btn-ghost"}`}
          aria-pressed={f.unread}
          aria-label="Hanya yang belum dibaca"
          title="Hanya yang belum dibaca"
          onClick={() => go({ unread: !f.unread })}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z" /><circle cx="18" cy="5" r="3" fill="currentColor" /></svg>
        </button>
      </div>

      <form role="search" onSubmit={(e) => { e.preventDefault(); go({ q }); }} className="flex gap-2">
        <label htmlFor="inbox-q" className="sr-only">Cari nama atau nomor</label>
        <input id="inbox-q" className="field !min-h-10 flex-1 !text-sm" placeholder="Cari nama atau nomor…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="submit" className="btn btn-secondary btn-sm">Cari</button>
      </form>

      <details className="rounded-lg border border-line-soft">
        <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-navy">
          Filter{activeFilters ? ` (${activeFilters})` : ""}
        </summary>
        <div className="grid gap-2 border-t border-line-soft p-3">
          <div>
            <label htmlFor="f-inbox" className="label !text-[13px]">Inbox</label>
            <select id="f-inbox" className="field !min-h-10 !text-sm" value={f.inbox ?? ""} onChange={(e) => go({ inbox: e.target.value || null })}>
              <option value="">Semua inbox</option>
              {inboxes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-label" className="label !text-[13px]">Label</label>
            <select id="f-label" className="field !min-h-10 !text-sm" value={f.label ?? ""} onChange={(e) => go({ label: e.target.value || null })}>
              <option value="">Semua label</option>
              {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          {(activeFilters > 0 || f.q || f.unread || f.agent !== "all") && (
            <Link href={inboxHref({ ...f, agent: "all", q: "", inbox: null, label: null, unread: false, c: null })} className="btn btn-ghost btn-sm justify-self-start" onClick={() => setQ("")}>
              Reset filter
            </Link>
          )}
        </div>
      </details>

      <nav aria-label="Status percakapan" className="grid grid-cols-3 gap-1 rounded-lg bg-bg p-1">
        {tabs.map((t) => {
          const on = f.tab === t.key;
          return (
            <Link
              key={t.key}
              href={inboxHref(f, { tab: t.key, c: null })}
              aria-current={on ? "page" : undefined}
              className={`rounded-md px-2 py-2 text-center text-[13px] transition ${on ? "bg-white font-bold text-navy shadow-sm" : "text-muted hover:text-navy"}`}
            >
              {t.label} <span className={on ? "text-brand" : ""}>{counts[t.key]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
