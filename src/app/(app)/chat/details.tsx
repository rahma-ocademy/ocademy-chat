"use client";

import { useState, useTransition } from "react";
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

  const run = (fn: () => Promise<ChatResult>, after?: () => void) => {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
      else after?.();
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <section aria-labelledby="h-contact">
        <h2 id="h-contact" className="mb-2 text-sm font-bold text-navy">Kontak</h2>
        <dl className="grid grid-cols-[72px_1fr] gap-x-2 gap-y-1.5 text-sm">
          <dt className="text-muted">Nama</dt><dd className="break-words">{contact?.name || "—"}</dd>
          <dt className="text-muted">Telepon</dt><dd className="break-words">{contact?.phone || "—"}</dd>
          <dt className="text-muted">Email</dt><dd className="break-words">{contact?.email || "—"}</dd>
          <dt className="text-muted">Inbox</dt><dd>{inboxName}</dd>
        </dl>
      </section>

      <section aria-labelledby="h-assign" className="border-t border-line-soft pt-4">
        <label id="h-assign" htmlFor="assignee" className="label">Ditangani oleh</label>
        <select
          id="assignee"
          className="field !text-sm"
          value={assigneeId ?? ""}
          disabled={pending}
          onChange={(e) => run(() => assignConversation(conversationId, e.target.value || null))}
        >
          <option value="">Belum di-assign</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
      </section>

      <section aria-labelledby="h-labels" className="border-t border-line-soft pt-4">
        <h2 id="h-labels" className="mb-2 text-sm font-bold text-navy">Label</h2>
        <ul className="mb-2 flex flex-wrap gap-1.5">
          {labels.length === 0 && <li className="text-[13px] text-muted">Belum ada label.</li>}
          {labels.map((l) => (
            <li key={l.id} className="inline-flex items-center gap-1 rounded-full bg-tint py-1 pr-1 pl-2.5 text-xs font-semibold text-navy">
              {l.name}
              <button
                type="button"
                className="flex size-5 items-center justify-center rounded-full hover:bg-white"
                aria-label={`Hapus label ${l.name}`}
                disabled={pending}
                onClick={() => run(() => removeLabel(conversationId, l.id))}
              >
                ×
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
          <button type="submit" className="btn btn-secondary btn-sm" disabled={pending || !newLabel.trim()}>Tambah</button>
        </form>
      </section>

      <section className="border-t border-line-soft pt-4">
        {status === "open" ? (
          <button type="button" className="btn btn-primary w-full" disabled={pending} onClick={() => run(() => setConversationStatus(conversationId, "resolved"))}>
            ✓ Tandai selesai
          </button>
        ) : (
          <button type="button" className="btn btn-secondary w-full" disabled={pending} onClick={() => run(() => setConversationStatus(conversationId, "open"))}>
            Buka lagi
          </button>
        )}
        <p className="hint">Pesan baru dari pelanggan otomatis membuka lagi percakapan yang sudah selesai.</p>
      </section>

      {error && <p role="alert" className="rounded-lg bg-bad-soft px-3 py-2 text-sm text-[#912018]">{error}</p>}
    </div>
  );
}
