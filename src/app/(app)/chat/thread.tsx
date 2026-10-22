"use client";

import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { CircleCheckBig, Lock, Reply, RotateCcw, Send, StickyNote } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { useToast } from "@/components/toast";
import { markRead, sendMessage, setConversationStatus } from "./actions";

type Msg = {
  id: string;
  direction: "in" | "out";
  sender_type: string;
  is_private: boolean;
  body: string;
  status: string;
  error?: string | null;
  created_at: string;
  author: string | null;
};

const TZ = "Asia/Jakarta";
const clock = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const dayLabel = (iso: string) => {
  const key = dayKey(iso);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today) return "Hari ini";
  if (key === yesterday) return "Kemarin";
  return new Date(iso).toLocaleDateString("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
};

const STATUS_TEXT: Record<string, string> = { queued: "dalam antrean", delivered: "terkirim", read: "dibaca", failed: "gagal" };

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
  const [pending, start] = useTransition();
  const toast = useToast();

  // Membuka percakapan = membacanya.
  useEffect(() => {
    if (unread > 0) void markRead(conversationId);
  }, [conversationId, unread]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [conversationId, messages.length]);

  const toggleStatus = () =>
    start(async () => {
      const r = await setConversationStatus(conversationId, status === "open" ? "resolved" : "open");
      if (!r.ok) toast.error(r.error);
      else toast.success(status === "open" ? "Percakapan ditandai selesai." : "Percakapan dibuka lagi.");
    });

  return (
    <>
      <header className="flex flex-wrap items-center gap-3 border-b border-line-soft px-5 py-3">
        <Avatar name={contactName} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[17px] font-bold text-navy">{contactName}</h2>
          <p className="flex items-center gap-2 text-[13px] text-muted">
            <span className={`size-2 rounded-full ${status === "open" ? "bg-accent" : "bg-line"}`} aria-hidden="true" />
            {status === "open" ? "Terbuka" : "Selesai"} · {inboxName}
          </p>
        </div>
        <button type="button" className={`btn btn-sm ${status === "open" ? "btn-outline" : "btn-secondary"}`} disabled={pending} onClick={toggleStatus}>
          {status === "open" ? <CircleCheckBig aria-hidden="true" className="size-4" /> : <RotateCcw aria-hidden="true" className="size-4" />}
          {status === "open" ? "Selesaikan" : "Buka lagi"}
        </button>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgb(41_56_103/0.06)_1px,transparent_0)] bg-bg [background-size:18px_18px] px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label="Riwayat pesan"
      >
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">Belum ada pesan.</p>}
        <ol className="flex flex-col gap-2">
          {messages.map((m, i) => {
            const mine = m.direction === "out";
            const newDay = i === 0 || dayKey(messages[i - 1].created_at) !== dayKey(m.created_at);
            const bubble = m.is_private
              ? "border border-[#F0D29A] bg-[#FFF7E8] text-[#5C3800] rounded-br-md"
              : mine
                ? "border border-[#BFE6EA] bg-[#E2F5F7] text-ink rounded-br-md"
                : "border border-line-soft bg-white text-ink rounded-bl-md";
            return (
              <Fragment key={m.id}>
                {newDay && (
                  <li className="my-2 flex justify-center" aria-hidden="true">
                    <span className="rounded-full border border-line-soft bg-white/90 px-3 py-1 text-[11px] font-semibold text-muted shadow-sm">{dayLabel(m.created_at)}</span>
                  </li>
                )}
                <li className={`rise flex ${mine || m.is_private ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 shadow-[0_1px_2px_rgb(41_56_103/0.08)] ${bubble}`}>
                    {(m.is_private || m.author) && (
                      <p className="mb-1 flex items-center gap-1 text-[11px] font-bold">
                        {m.is_private && <Lock aria-hidden="true" className="size-3" />}
                        {m.is_private ? `Catatan internal · ${m.author ?? ""}` : m.author}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.body}</p>
                    {m.status === "failed" && m.error && <p className="mt-1 text-[12px] text-bad">{m.error}</p>}
                    <p className={`mt-1 text-right text-[11px] ${m.status === "failed" ? "font-semibold text-bad" : "text-muted"}`}>
                      <time dateTime={m.created_at}>{clock(m.created_at)}</time>
                      {(mine && !m.is_private) || m.status === "failed" ? (STATUS_TEXT[m.status] ? ` · ${STATUS_TEXT[m.status]}` : "") : ""}
                    </p>
                  </div>
                </li>
              </Fragment>
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
  const toast = useToast();
  const [pending, start] = useTransition();

  const send = () => {
    const body = text.trim();
    if (!body || pending) return;
    start(async () => {
      const r = await sendMessage(conversationId, body, note);
      if (r.ok) {
        setText("");
        if (note) toast.success("Catatan internal disimpan.");
      } else toast.error(r.error);
    });
  };

  const mode = (isNote: boolean, label: string, Icon: typeof Reply) => (
    <button
      type="button"
      aria-pressed={note === isNote}
      onClick={() => setNote(isNote)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent ${
        note === isNote ? (isNote ? "bg-[#FDF0D5] text-[#5C3800]" : "bg-brand-soft text-[#01606A]") : "text-muted hover:text-navy"
      }`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {label}
    </button>
  );

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); send(); }}
      className={`flex flex-col gap-2 border-t p-3 transition-colors ${note ? "border-[#F0D29A] bg-[#FFFBF2]" : "border-line-soft bg-white"}`}
    >
      <div className="flex items-center gap-1" role="group" aria-label="Jenis pesan">
        {mode(false, "Balas pelanggan", Reply)}
        {mode(true, "Catatan internal", StickyNote)}
      </div>
      <label htmlFor="composer" className="sr-only">{note ? "Tulis catatan internal" : "Tulis balasan"}</label>
      <div className={`flex items-end gap-2 rounded-xl border bg-white p-1.5 transition focus-within:ring-[3px] ${note ? "border-[#F0D29A] focus-within:ring-[#F0D29A]/40" : "border-line focus-within:border-brand focus-within:ring-accent/25"}`}>
        <textarea
          id="composer"
          rows={2}
          className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] leading-relaxed text-ink outline-none placeholder:text-muted"
          placeholder={note ? "Catatan internal — hanya terlihat oleh tim…" : "Tulis balasan…"}
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
        <button type="submit" className="btn btn-primary btn-sm !min-h-10" disabled={pending || !text.trim()} aria-label={note ? "Simpan catatan" : "Kirim"}>
          <Send aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">{pending ? "Mengirim…" : note ? "Simpan" : "Kirim"}</span>
        </button>
      </div>
      <p className="hidden text-[11px] text-muted sm:block">
        <kbd className="kbd">Enter</kbd> kirim · <kbd className="kbd">Shift</kbd> + <kbd className="kbd">Enter</kbd> baris baru
      </p>
    </form>
  );
}
