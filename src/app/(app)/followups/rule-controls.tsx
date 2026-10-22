"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import { deleteRule, toggleRule } from "./actions";

export function RuleToggle({ id, active, label }: { id: string; active: boolean; label: string }) {
  const [checked, setChecked] = useState(active);
  const toast = useToast();
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
          start(async () => {
            const r = await toggleRule(id, next);
            if (!r.ok) {
              setChecked(!next);
              toast.error(r.error);
            } else {
              toast.success(next ? "Aturan diaktifkan." : "Aturan dinonaktifkan.");
            }
          });
        }}
      />
    </span>
  );
}

export function DeleteRuleButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn btn-danger btn-sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Hapus aturan "${name}"? Pesan yang sudah terjadwal dari aturan ini tidak akan dikirim.`)) {
          start(async () => {
            const r = await deleteRule(id);
            if (r.error) toast.error(r.error);
            else toast.success(`Aturan "${name}" dihapus.`);
          });
        }
      }}
    >
      {pending ? "Menghapus…" : "Hapus"}
    </button>
  );
}
