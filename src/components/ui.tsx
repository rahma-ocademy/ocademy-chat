"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Info } from "lucide-react";

/**
 * Ikon (i) dengan penjelasan singkat. Muncul saat hover/fokus (desktop) atau saat diketuk (HP);
 * Esc atau klik di luar menutupnya. Isi tooltip juga dibacakan pembaca layar lewat aria-describedby.
 */
export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const open = hover || pinned;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPinned(false);
        setHover(false);
      }
    };
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setPinned(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex align-middle" onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        className={`flex size-5 cursor-help items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent ${
          open ? "bg-brand text-white" : "text-muted hover:bg-brand-soft hover:text-brand"
        }`}
      >
        <Info aria-hidden="true" className="size-4" />
      </button>
      <span
        id={id}
        role="tooltip"
        className={`absolute top-full left-1/2 z-50 mt-2 w-72 max-w-[80vw] -translate-x-1/2 rounded-xl bg-navy px-3.5 py-3 text-left text-[13px] leading-relaxed font-normal text-white shadow-[var(--shadow-pop)] ${
          open ? "rise block" : "hidden"
        }`}
      >
        <span aria-hidden="true" className="absolute -top-1.5 left-1/2 size-3 -translate-x-1/2 rotate-45 bg-navy" />
        <span className="relative block">{children}</span>
      </span>
    </span>
  );
}

/** Tombol submit yang otomatis nonaktif + berubah label saat form diproses. */
export function SubmitButton({
  children,
  pending = "Memproses…",
  className = "btn btn-primary",
}: {
  children: React.ReactNode;
  pending?: string;
  className?: string;
}) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" disabled={busy} className={className} aria-busy={busy}>
      {busy ? pending : children}
    </button>
  );
}

export function CopyButton({ value, label = "Salin" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          /* clipboard tidak tersedia (mis. http non-localhost) */
        }
      }}
    >
      {done ? <Check aria-hidden="true" className="size-4 text-ok" /> : <Copy aria-hidden="true" className="size-4" />}
      <span role={done ? "status" : undefined}>{done ? "Tersalin" : label}</span>
    </button>
  );
}
