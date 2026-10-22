"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

type Tone = "ok" | "bad";
type ToastItem = { id: number; tone: Tone; text: string };
type ToastApi = { success: (text: string) => void; error: (text: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

/** Sukses hilang sendiri cepat; gagal bertahan lebih lama supaya sempat dibaca. */
const LIFETIME: Record<Tone, number> = { ok: 4000, bad: 7000 };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(0);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (tone: Tone, text: string) => {
      const id = ++next.current;
      setItems((l) => [...l.slice(-3), { id, tone, text }]);
      setTimeout(() => dismiss(id), LIFETIME[tone]);
    },
    [dismiss],
  );
  const api = useMemo<ToastApi>(() => ({ success: (t) => push("ok", t), error: (t) => push("bad", t) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-4 sm:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "bad" ? "alert" : "status"}
            className={`rise pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-[var(--shadow-pop)] ${
              t.tone === "bad" ? "border-bad/30 bg-bad-soft text-[#912018]" : "border-[#BFE5D8] bg-ok-soft text-ok"
            }`}
          >
            {t.tone === "bad" ? (
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            )}
            <p className="min-w-0 flex-1 break-words">{t.text}</p>
            <button
              type="button"
              aria-label="Tutup notifikasi"
              onClick={() => dismiss(t.id)}
              className="-m-1 rounded-md p-1 opacity-70 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam <ToastProvider>");
  return ctx;
}

type Result = { ok?: boolean; error?: string | null; message?: string | null; note?: string | null };

/**
 * Munculkan toast tiap kali hasil aksi berubah. `okText` dipakai bila hasil hanya `ok: true`
 * tanpa pesan sendiri. Objek hasil baru dibuat tiap submit, jadi submit berulang tetap memicu toast.
 */
export function useResultToast(result: Result | null | undefined, okText = "Tersimpan.") {
  const toast = useToast();
  useEffect(() => {
    if (!result) return;
    if (result.error) toast.error(result.error);
    else if (result.message ?? result.note) toast.success((result.message ?? result.note) as string);
    else if (result.ok) toast.success(okText);
  }, [result, okText, toast]);
}
