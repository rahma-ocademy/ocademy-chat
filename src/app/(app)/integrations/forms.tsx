"use client";

import { useActionState, useState, useTransition } from "react";
import { connectOrderOnline, createApiKey, disconnectOrderOnline, resyncOrderOnline, revokeApiKey, type KeyState, type OOState } from "./actions";
import { CopyButton, SubmitButton } from "@/components/ui";
import { useResultToast, useToast } from "@/components/toast";
import { SCOPES_INFO } from "./scopes";

export function CreateKeyForm() {
  const [state, action] = useActionState<KeyState, FormData>(createApiKey, {});
  useResultToast(state.key ? { message: `Kunci untuk “${state.name}” dibuat. Salin sekarang.` } : state);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="max-w-md">
        <label htmlFor="int-name" className="label">Nama integrasi</label>
        <input id="int-name" name="name" className="field" placeholder="mis. Toko online saya" required />
      </div>
      <fieldset>
        <legend className="label">Izin</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SCOPES_INFO.map((s) => (
            <label key={s.scope} className="flex items-start gap-2.5 text-sm leading-snug">
              <input type="checkbox" name="scopes" value={s.scope} defaultChecked={s.defaultOn} className="mt-0.5 size-[18px] accent-brand" />
              <span><code className="font-mono text-[13px] text-navy">{s.scope}</code><br /><span className="text-muted">{s.desc}</span></span>
            </label>
          ))}
        </div>
      </fieldset>
      {state.key && (
        <div className="flex flex-col gap-3 rounded-xl border border-[#BFE5D8] bg-ok-soft p-4">
          <p className="text-sm font-bold text-ok">Kunci untuk “{state.name}” dibuat. Salin sekarang: kunci ini tidak akan ditampilkan lagi.</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-white px-3 py-2.5 font-mono text-[13px] whitespace-nowrap text-navy">{state.key}</code>
            <CopyButton value={state.key} />
          </div>
        </div>
      )}
      <SubmitButton className="btn btn-primary self-start">Buat integrasi &amp; kunci</SubmitButton>
    </form>
  );
}

export function RevokeButton({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <button
      type="button"
      className="btn btn-danger btn-sm"
      disabled={pending}
      onClick={() => {
        if (window.confirm(`Cabut kunci "${name}"? Aplikasi yang memakainya langsung kehilangan akses.`)) {
          start(async () => {
            const r = await revokeApiKey(id);
            if (r.error) toast.error(r.error);
            else toast.success(`Kunci "${name}" dicabut.`);
          });
        }
      }}
    >
      {pending ? "Mencabut…" : "Cabut"}
    </button>
  );
}

export function ConnectOrderOnlineForm() {
  const [state, action] = useActionState<OOState, FormData>(connectOrderOnline, {});
  useResultToast(state);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label htmlFor="oo-token" className="label">Personal Access Token OrderOnline</label>
        <div className="flex flex-wrap gap-2">
          <input id="oo-token" name="token" type={show ? "text" : "password"} autoComplete="off" spellCheck={false} className="field min-w-64 flex-1 font-mono text-sm" required />
          <button type="button" className="btn btn-secondary" onClick={() => setShow((s) => !s)}>{show ? "Sembunyikan" : "Tampilkan"}</button>
        </div>
        <p className="hint">Token disimpan terenkripsi dan bisa dicabut kapan saja dengan memutus integrasi.</p>
      </div>
      <SubmitButton className="btn btn-primary btn-lg self-start" pending="Menghubungkan…">Hubungkan &amp; impor template</SubmitButton>
    </form>
  );
}

export function OrderOnlineActions() {
  const [msg, setMsg] = useState<OOState>({});
  const [pending, start] = useTransition();
  useResultToast(msg);
  const run = (fn: () => Promise<OOState>) => start(async () => setMsg(await fn()));
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2.5">
        <button type="button" className="btn btn-secondary" disabled={pending} onClick={() => run(resyncOrderOnline)}>
          {pending ? "Memproses…" : "↻ Sinkron ulang"}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending}
          onClick={() => { if (window.confirm("Putuskan OrderOnline? Token dihapus dan follow-up yang menunggu dibatalkan.")) run(disconnectOrderOnline); }}
        >
          Putuskan
        </button>
      </div>
    </div>
  );
}
