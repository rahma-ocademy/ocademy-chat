"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { MessagesSquare, Send } from "lucide-react";

type Msg = { id: string; from: "me" | "agent" | "ai"; body: string; created_at: string };

const storageKey = (key: string) => `ocademy_lc_${key}`;
const readToken = (key: string) => {
  try { return localStorage.getItem(storageKey(key)); } catch { return null; }
};
const saveToken = (key: string, token: string) => {
  try { localStorage.setItem(storageKey(key), token); } catch { /* mode privat: token hanya bertahan di memori */ }
};

export function LivechatWidget({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const [token, setToken] = useState<string | null>(null);
  const [title, setTitle] = useState("Chat");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- token hanya ada di localStorage (browser)
  useEffect(() => setToken(readToken(key)), [key]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/livechat/${key}`, { headers: token ? { "x-visitor-token": token } : {}, cache: "no-store" });
    if (res.status === 404) return setUnavailable(true);
    if (!res.ok) return;
    const json = await res.json();
    setTitle(json.data.inbox_name);
    setMessages(json.data.messages);
  }, [key, token]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 3000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/livechat/${key}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { "x-visitor-token": token } : {}) },
        body: JSON.stringify({ message, ...(token ? {} : { name: name || undefined, phone: phone || undefined }) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "Pesan gagal dikirim.");
      if (!token) {
        saveToken(key, json.data.visitor_token);
        setToken(json.data.visitor_token);
      }
      setText("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (unavailable) {
    return <div className="card p-8 text-center text-sm text-muted">Chat ini sedang tidak tersedia.</div>;
  }

  return (
    <section className="card flex min-h-[560px] flex-1 flex-col overflow-hidden" aria-label={`Chat dengan ${title}`}>
      <header className="bg-brand-gradient relative flex items-center gap-3 overflow-hidden px-5 py-4 text-white">
        <span aria-hidden="true" className="absolute -top-10 -right-8 size-32 rounded-full bg-white/10" />
        <span aria-hidden="true" className="relative flex size-11 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30">
          <MessagesSquare className="size-5" />
          <span className="absolute right-0 bottom-0 size-3 rounded-full border-2 border-[#1f5c80] bg-[#4CD98B]" />
        </span>
        <div className="relative min-w-0">
          <h1 className="truncate text-lg font-bold">{title}</h1>
          <p className="text-[13px] text-white">Online · biasanya membalas dalam beberapa menit</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-bg p-4" role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="mx-auto mt-6 max-w-[85%] rounded-2xl rounded-bl-md border border-line-soft bg-white px-4 py-3 text-sm text-ink shadow-sm">
            Halo! 👋 Ada yang bisa kami bantu?
          </p>
        )}
        <ol className="flex flex-col gap-2">
          {messages.map((m) => (
            <li key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
              <p className={`rise max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm ${m.from === "me" ? "rounded-br-md bg-brand text-white" : "rounded-bl-md border border-line-soft bg-white text-ink"}`}>
                {m.body}
              </p>
            </li>
          ))}
        </ol>
        <div ref={bottom} />
      </div>

      <form onSubmit={send} className="flex flex-col gap-2 border-t border-line-soft bg-white p-3">
        {!token && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="lc-name" className="sr-only">Nama</label>
              <input id="lc-name" className="field !min-h-10 !text-sm" placeholder="Nama (opsional)" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <div>
              <label htmlFor="lc-phone" className="sr-only">Nomor WhatsApp</label>
              <input id="lc-phone" className="field !min-h-10 !text-sm" placeholder="No. WhatsApp (opsional)" value={phone} maxLength={32} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <label htmlFor="lc-msg" className="sr-only">Pesan</label>
          <input id="lc-msg" className="field flex-1" placeholder="Tulis pesan…" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} autoComplete="off" />
          <button type="submit" className="btn btn-primary !px-3.5" disabled={sending || !text.trim()} aria-label="Kirim">
            <Send aria-hidden="true" className="size-4" />
          </button>
        </div>
        {error && <p role="alert" className="text-sm text-bad">{error}</p>}
      </form>
    </section>
  );
}
