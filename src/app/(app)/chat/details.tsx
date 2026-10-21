"use client";

import { useState, useTransition } from "react";
import { CircleCheckBig, Inbox, Mail, Phone, Plus, RotateCcw, Tag, UserCheck, X } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { addLabel, assignConversation, removeLabel, setConversationStatus, type ChatResult } from "./actions";

type Label = { id: string; name: string; color: string };

export function Details({
  conversationId,
  status,
  assigneeId,
  contact,
  inboxName,
  agents,
  labels,
  allLabels,
}: {
  conversationId: string;
  status: "open" | "resolved";
  assigneeId: string | null;
  contact: { name: string | null; phone: string | null; email: string | null } | null;
  inboxName: string;
  agents: { id: string; label: string }[];
  labels: Label[];
  allLabels: Label[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const name = contact?.name || contact?.phone || "Pengunjung";

  const run = (fn: () => Promise<ChatResult>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else after?.();
    });
  };

  const rows = [
    { icon: Phone, label: "Telepon", value: contact?.phone },
    { icon: Mail, label: "Email", value: contact?.email },
    { icon: Inbox, label: "Inbox", value: inboxName },
  ];

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="h-contact" className="flex flex-col items-center gap-2 rounded-2xl bg-[linear-gradient(180deg,#F2FAFB,transparent)] px-3 pt-4 text-center">
        <Avatar name={name} size="lg" />
        <h2 id="h-contact" className="mt-1 max-w-full truncate text-[17px] font-bold text-navy">{name}</h2>
        <dl className="mt-1 flex w-full flex-col gap-1.5 text-left text-sm">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.label} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-bg">
                <Icon aria-hidden="true" className="size-4 shrink-0 text-muted" />
                <dt className="sr-only">{r.label}</dt>
                <dd className={`min-w-0 break-words ${r.value ? "text-ink" : "text-muted"}`}>{r.value || "—"}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section aria-labelledby="h-assign" className="border-t border-line-soft pt-4">
        <label id="h-assign" htmlFor="assignee" className="label flex items-center gap-1.5">
          <UserCheck aria-hidden="true" className="size-4 text-brand" /> Ditangani oleh
        </label>
        <select
          id="assignee"
          className="field !min-h-10 !text-sm"
          value={assigneeId ?? ""}
          disabled={pending}
          onChange={(e) => run(() => assignConversation(conversationId, e.target.value || null))}
        >
          <option value="">Belum diambil</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </section>

      <section aria-labelledby="h-labels" className="border-t border-line-soft pt-4">
        <h2 id="h-labels" className="label flex items-center gap-1.5">
          <Tag aria-hidden="true" className="size-4 text-brand" /> Label
        </h2>
        <ul className="mb-2.5 flex flex-wrap gap-1.5">
          {labels.length === 0 && <li className="text-[13px] text-muted">Belum ada label.</li>}
          {labels.map((l) => (
            <li key={l.id} className="inline-flex items-center gap-1 rounded-full border border-line-soft bg-white py-1 pr-1 pl-2 text-xs font-semibold text-navy shadow-sm">
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: l.color || "var(--color-accent)" }} />
              {l.name}
              <button
                type="button"
                className="flex size-5 items-center justify-center rounded-full text-muted hover:bg-bad-soft hover:text-bad"
                aria-label={`Hapus label ${l.name}`}
                disabled={pending}
                onClick={() => run(() => removeLabel(conversationId, l.id))}
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newLabel.trim()) run(() => addLabel(conversationId, newLabel), () => setNewLabel(""));
          }}
        >
          <label htmlFor="new-label" className="sr-only">Tambah label</label>
          <input id="new-label" list="label-options" className="field !min-h-9 flex-1 !text-sm" placeholder="Tambah label…" value={newLabel} maxLength={40} onChange={(e) => setNewLabel(e.target.value)} />
          <datalist id="label-options">{allLabels.map((l) => <option key={l.id} value={l.name} />)}</datalist>
          <button type="submit" className="btn btn-secondary btn-sm !px-2.5" disabled={pending || !newLabel.trim()} aria-label="Tambah label">
            <Plus aria-hidden="true" className="size-4" />
          </button>
        </form>
      </section>

      <section className="border-t border-line-soft pt-4">
        {status === "open" ? (
          <button type="button" className="btn btn-primary w-full" disabled={pending} onClick={() => run(() => setConversationStatus(conversationId, "resolved"))}>
            <CircleCheckBig aria-hidden="true" className="size-4" /> Tandai selesai
          </button>
        ) : (
          <button type="button" className="btn btn-secondary w-full" disabled={pending} onClick={() => run(() => setConversationStatus(conversationId, "open"))}>
            <RotateCcw aria-hidden="true" className="size-4" /> Buka lagi
          </button>
        )}
        <p className="hint text-center">Pesan baru dari pelanggan otomatis membuka lagi percakapan yang sudah selesai.</p>
      </section>

      {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-[#912018]">{error}</p>}
    </div>
  );
}
