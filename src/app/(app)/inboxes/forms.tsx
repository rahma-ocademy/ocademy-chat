"use client";

import { useActionState, useTransition } from "react";
import { createInbox, setInboxActive, type InboxState } from "./actions";
import { SubmitButton } from "@/components/ui";

export function CreateInboxForm() {
  const [state, action] = useActionState<InboxState, FormData>(createInbox, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <label htmlFor="inbox-name" className="label">Nama inbox livechat</label>
        <input id="inbox-name" name="name" className="field" placeholder="mis. Website toko" required />
      </div>
      <SubmitButton>+ Buat inbox livechat</SubmitButton>
      {state.error && <p role="alert" className="basis-full text-sm text-bad">{state.error}</p>}
      {state.ok && <p role="status" className="basis-full text-sm text-ok">Inbox dibuat.</p>}
    </form>
  );
}

export function InboxToggle({ id, active, name }: { id: string; active: boolean; name: string }) {
  const [pending, start] = useTransition();
  return (
    <input
      type="checkbox"
      role="switch"
      className="switch"
      checked={active}
      disabled={pending}
      aria-label={`Aktifkan inbox ${name}`}
      onChange={(e) => {
        const next = e.target.checked;
        start(async () => { await setInboxActive(id, next); });
      }}
    />
  );
}
