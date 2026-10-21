"use client";

import { useState, useTransition } from "react";
import { acceptInvite } from "./actions";

export function AcceptButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="btn btn-primary btn-lg"
        disabled={pending}
        onClick={() => start(async () => setError((await acceptInvite(token))?.error ?? null))}
      >
        {pending ? "Bergabung…" : "Terima undangan"}
      </button>
      {error && <p role="alert" className="text-sm text-bad">{error}</p>}
    </div>
  );
}
