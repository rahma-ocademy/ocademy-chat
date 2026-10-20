"use client";

import { useState, useTransition } from "react";
import { deleteRule, toggleRule } from "./actions";

export function RuleToggle({ id, active, label }: { id: string; active: boolean; label: string }) {
  const [checked, setChecked] = useState(active);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <input
        type="checkbox"
        role="switch"
        className="switch"
        checked={checked}
        disabled={pending}
        aria-label={label}
        onChange={(e) => {
          const next = e.target.checked;
          setChecked(next);
          setError(null);
          start(async () => {
            const r = await toggleRule(id, next);
            if (!r.ok) {
              setChecked(!next);
              setError(r.error);
            }
          });
        }}
      />
      {error ? <span role="alert" className="text-xs text-bad">{error}</span> : null}
    </span>
  );
}

export function DeleteRuleButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn btn-danger btn-sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Hapus aturan "${name}"? Pesan yang sudah terjadwal dari aturan ini tidak akan dikirim.`)) {
          start(async () => {
            await deleteRule(id);
          });
        }
      }}
    >
      {pending ? "Menghapus…" : "Hapus"}
    </button>
  );
}
