"use client";

import { useFormStatus } from "react-dom";
import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, Info } from "lucide-react";

/**
 * Ikon (i) dengan penjelasan singkat. Muncul saat hover/fokus (desktop) atau saat diketuk (HP);
 * Esc atau klik di luar menutupnya. Isi tooltip juga dibacakan pembaca layar lewat aria-describedby.
 * Posisi `fixed` dihitung dari tombol, jadi tidak terpotong wadah yang menggulir (mis. tabel).
 */
const TIP_W = 288;
type TipPos = { top: number; left: number; arrow: number; above: boolean };

export function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [hover, setHover] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<TipPos | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const open = hover || pinned;

  const place = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(TIP_W, window.innerWidth - 16);
    const center = r.left + r.width / 2;
    const left = Math.min(Math.max(8, center - width / 2), window.innerWidth - width - 8);
    const above = window.innerHeight - r.bottom < 200 && r.top > 200;
    setPos({ top: above ? r.top - 8 : r.bottom + 8, left, arrow: center - left, above });
  };
  const show = () => {
    place();
    setHover(true);
  };

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
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  return (
    <span ref={ref} className="inline-flex align-middle" onMouseEnter={show} onMouseLeave={() => setHover(false)}>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => {
          place();
          setPinned((p) => !p);
        }}
        onFocus={show}
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
        style={pos ? { top: pos.top, left: pos.left, width: Math.min(TIP_W, typeof window === "undefined" ? TIP_W : window.innerWidth - 16) } : undefined}
        className={`fixed z-[60] rounded-xl bg-navy px-3.5 py-3 text-left text-[13px] leading-relaxed font-normal tracking-normal whitespace-normal normal-case text-white shadow-[var(--shadow-pop)] ${
          pos?.above ? "-translate-y-full" : ""
        } ${open && pos ? "rise block" : "hidden"}`}
      >
        <span
          aria-hidden="true"
          style={{ left: pos ? pos.arrow : 0 }}
          className={`absolute size-3 -translate-x-1/2 rotate-45 bg-navy ${pos?.above ? "-bottom-1.5" : "-top-1.5"}`}
        />
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
