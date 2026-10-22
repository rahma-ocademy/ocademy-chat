"use client";

import { useTransition } from "react";
import { useToast } from "@/components/toast";
import { acceptInvite } from "./actions";

export function AcceptButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="btn btn-primary btn-lg"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await acceptInvite(token);
          if (r?.error) toast.error(r.error);
        })}
      >
        {pending ? "Bergabung…" : "Terima undangan"}
      </button>
    </div>
  );
}
