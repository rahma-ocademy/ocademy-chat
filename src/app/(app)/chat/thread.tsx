"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { markRead, sendMessage } from "./actions";

type Msg = {
  id: string;
  direction: "in" | "out";
  sender_type: string;
  is_private: boolean;
  body: string;
  status: string;
  created_at: string;
  author: string | null;
};

const time = (iso: string) =>
  new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function ThreadView({
  conversationId,
  unread,
  contactName,
  inboxName,
  status,
  messages,
}: {
  conversationId: string;
  unread: number;
  contactName: string;
  inboxName: string;
  status: "open" | "resolved";
  messages: Msg[];
}) {
  const bottom = useRef<HTMLDivElement>(null);

  // Membuka percakapan = membacanya.
  useEffect(() => {
    if (unread > 0) void markRead(conversationId);
  }, [conversationId, unread]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [conversationId, messages.length]);

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="truncate text-[17px] font-bold text-navy">{contactName}</h2>
          <p className="text-[13px] text-muted">{inboxName}</p>
        </div>
        <span className={`badge ${status === "open" ? "badge-info" : "badge-muted"}`}>{status === "open" ? "Terbuka" : "Selesai"}</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-bg px-4 py-4" role="log" aria-live="polite" aria-label="Riwayat pesan">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">Belum ada pesan.</p>}
        <ol className="flex flex-col gap-2.5">
          {messages.map((m) => {
            const mine = m.direction === "out";
            const bubble = m.is_private
              ? "border border-[#F0D29A] bg-[#FFF7E8] text-[#5C3800]"
              : mine
                ? "bg-brand-soft text-ink border border-[#CDEBEF]"
                : "bg-white text-ink border border-line-soft";
            return (
              <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-sm ${bubble}`}>
                  {(m.is_private || m.author) && (
                    <p className="mb-1 text-[11px] font-bold">{m.is_private ? `Catatan internal · ${m.author ?? ""}` : m.author}</p>
                  )}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                  <p className="mt-1 text-right text-[11px] text-muted">
                    {time(m.created_at)}
                    {mine && !m.is_private && m.status === "queued" ? " · dalam antrean" : ""}
                    {m.status === "failed" ? " · gagal" : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        <div ref={bottom} />
      </div>

      <Composer conversationId={conversationId} />
    </>
  );
}

function Composer({ conversationId }: { conversationId: string }) {
  const [text, setText] = useState("");
  const [note, setNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    setError(null);
    start(async () => {
      const r = await sendMessage(conversationId, body, note);
      if (r.ok) setText("");
      else setError(r.error);
    });
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); send(); }}
      className={`flex flex-col gap-2 border-t p-3 ${note ? "border-[#F0D29A] bg-[#FFFBF2]" : "border-line-soft bg-white"}`}
    >
      <label htmlFor="composer" className="sr-only">{note ? "Tulis catatan internal" : "Tulis balasan"}</label>
      <textarea
        id="composer"
        rows={3}
        className="field resize-none py-2.5 leading-relaxed"
        placeholder={note ? "Catatan internal — hanya terlihat oleh tim…" : "Tulis balasan… (Enter kirim, Shift+Enter baris baru)"}
        value={text}
        maxLength={4096}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
      />
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" role="switch" className="switch" checked={note} onChange={(e) => setNote(e.target.checked)} />
          Catatan internal
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={pending || !text.trim()}>
          {pending ? "Mengirim…" : note ? "Simpan catatan" : "Kirim"}
        </button>
      </div>
    </form>
  );
}
