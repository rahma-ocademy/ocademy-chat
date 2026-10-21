"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CircleCheckBig, Hourglass, MessageCircleMore, Search, SlidersHorizontal, UserCheck, X } from "lucide-react";
import { inboxHref, type InboxFilters, type InboxTab } from "@/lib/inbox/filters";

type Option = { id: string; label: string };

const TABS: { key: InboxTab; label: string; icon: typeof UserCheck }[] = [
  { key: "assigned", label: "Ditugaskan", icon: UserCheck },
  { key: "unassigned", label: "Belum diambil", icon: Hourglass },
  { key: "resolved", label: "Selesai", icon: CircleCheckBig },
];

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
  const [showFilters, setShowFilters] = useState(false);
  const go = (patch: Partial<InboxFilters>) => router.push(inboxHref(f, { ...patch, c: null }));

  const active: { key: string; label: string; clear: Partial<InboxFilters> }[] = [];
  if (f.agent !== "all") active.push({ key: "agent", label: f.agent === "me" ? "Agen: Saya" : `Agen: ${agents.find((a) => a.id === f.agent)?.label ?? "—"}`, clear: { agent: "all" } });
  if (f.inbox) active.push({ key: "inbox", label: `Inbox: ${inboxes.find((i) => i.id === f.inbox)?.name ?? "—"}`, clear: { inbox: null } });
  if (f.label) active.push({ key: "label", label: `Label: ${labels.find((l) => l.id === f.label)?.name ?? "—"}`, clear: { label: null } });
  if (f.unread) active.push({ key: "unread", label: "Belum dibaca", clear: { unread: false } });
  if (f.q) active.push({ key: "q", label: `“${f.q}”`, clear: { q: "" } });

  return (
    <div className="flex flex-col gap-3 border-b border-line-soft p-3">
      <div className="flex items-center gap-2">
        <form role="search" onSubmit={(e) => { e.preventDefault(); go({ q }); }} className="relative flex-1">
          <label htmlFor="inbox-q" className="sr-only">Cari nama atau nomor</label>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
          <input id="inbox-q" type="search" className="field !min-h-10 !pl-9 !text-sm" placeholder="Cari nama atau nomor…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <button
          type="button"
          className={`btn btn-sm !min-h-10 !px-2.5 ${f.unread ? "btn-outline" : "btn-secondary"}`}
          aria-pressed={f.unread}
          aria-label="Hanya yang belum dibaca"
          data-tip="Belum dibaca"
          data-tip-pos="bottom"
          onClick={() => go({ unread: !f.unread })}
        >
          <MessageCircleMore aria-hidden="true" className="size-[18px]" />
        </button>
        <button
          type="button"
          className={`btn btn-sm !min-h-10 !px-2.5 ${showFilters || active.some((a) => a.key === "inbox" || a.key === "label" || a.key === "agent") ? "btn-outline" : "btn-secondary"}`}
          aria-expanded={showFilters}
          aria-controls="inbox-filters"
          aria-label="Filter"
          data-tip="Filter"
          data-tip-pos="bottom"
          onClick={() => setShowFilters((s) => !s)}
        >
          <SlidersHorizontal aria-hidden="true" className="size-[18px]" />
        </button>
      </div>

      {showFilters && (
        <div id="inbox-filters" className="rise grid gap-2.5 rounded-xl border border-line-soft bg-bg p-3">
          <div>
            <label htmlFor="agent-filter" className="label !mb-1 !text-[13px]">Ditangani oleh</label>
            <select id="agent-filter" className="field !min-h-9 !text-sm" value={f.agent} onChange={(e) => go({ agent: e.target.value })}>
              <option value="all">Semua agen</option>
              <option value="me">Saya</option>
              {agents.filter((a) => a.id !== userId).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="f-inbox" className="label !mb-1 !text-[13px]">Inbox</label>
              <select id="f-inbox" className="field !min-h-9 !text-sm" value={f.inbox ?? ""} onChange={(e) => go({ inbox: e.target.value || null })}>
                <option value="">Semua</option>
                {inboxes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="f-label" className="label !mb-1 !text-[13px]">Label</label>
              <select id="f-label" className="field !min-h-9 !text-sm" value={f.label ?? ""} onChange={(e) => go({ label: e.target.value || null })}>
                <option value="">Semua</option>
                {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {active.length > 0 && (
        <ul className="flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
          {active.map((a) => (
            <li key={a.key}>
              <Link
                href={inboxHref(f, { ...a.clear, c: null })}
                className="chip chip-on !min-h-7 !pr-1.5 !text-xs"
                aria-label={`Hapus filter ${a.label}`}
                onClick={() => a.key === "q" && setQ("")}
              >
                <span className="max-w-[160px] truncate">{a.label}</span>
                <X aria-hidden="true" className="size-3.5" />
              </Link>
            </li>
          ))}
          {active.length > 1 && (
            <li>
              <Link
                href={inboxHref({ ...f, agent: "all", q: "", inbox: null, label: null, unread: false, c: null })}
                className="px-1 text-xs font-semibold text-muted hover:text-navy hover:underline"
                onClick={() => setQ("")}
              >
                Hapus semua
              </Link>
            </li>
          )}
        </ul>
      )}

      <nav aria-label="Status percakapan" className="grid grid-cols-3 gap-1 rounded-xl bg-bg p-1">
        {TABS.map((t) => {
          const on = f.tab === t.key;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={inboxHref(f, { tab: t.key, c: null })}
              aria-current={on ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent ${
                on ? "bg-white text-navy shadow-sm" : "text-muted hover:bg-white/60 hover:text-navy"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Icon aria-hidden="true" className={`size-4 ${on ? "text-brand" : ""}`} />
                <span className={`text-[15px] font-bold ${on ? "text-navy" : ""}`}>{counts[t.key]}</span>
              </span>
              <span className={`text-[12px] leading-tight ${on ? "font-bold" : "font-medium"}`}>{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
