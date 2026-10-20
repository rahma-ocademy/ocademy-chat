"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";

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
      {done ? "Tersalin ✓" : label}
    </button>
  );
}
