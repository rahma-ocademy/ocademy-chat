"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { SubmitButton } from "@/components/ui";
import { createLivechatInbox, disconnectWhatsApp, retryCoexSync, updateInboxSettings, type FormState } from "./actions";

export function InboxSettingsForm({
  inbox,
  aiAgents,
  members,
  readOnly,
}: {
  inbox: { id: string; name: string; active: boolean; aiAgentId: string | null };
  aiAgents: { id: string; name: string }[];
  members: { id: string; label: string; checked: boolean }[];
  readOnly: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(updateInboxSettings, {});
  return (
    <form action={action} className="flex flex-col gap-5 border-t border-line-soft pt-5">
      <input type="hidden" name="id" value={inbox.id} />
      <fieldset disabled={readOnly} className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label htmlFor="inbox-name" className="label">Nama inbox</label>
            <input id="inbox-name" name="name" className="field" defaultValue={inbox.name} required minLength={2} maxLength={60} />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-navy">
            <input type="checkbox" role="switch" name="active" className="switch" defaultChecked={inbox.active} />
            Inbox aktif
          </label>
        </div>

        <div>
          <label htmlFor="inbox-ai" className="label">AI agent</label>
          <select id="inbox-ai" name="ai_agent_id" className="field" defaultValue={inbox.aiAgentId ?? ""}>
            <option value="">Tanpa AI agent (dijawab agen manusia)</option>
            {aiAgents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <p className="hint">
            {aiAgents.length === 0 ? (
              <>Belum ada AI agent. <Link href="/ai-agents" className="font-semibold text-brand underline">Buat AI agent</Link>.</>
            ) : (
              "Konfigurasi AI disimpan; balasan AI otomatis belum aktif di versi ini."
            )}
          </p>
        </div>

        <fieldset>
          <legend className="label">Agen yang menangani inbox ini</legend>
          {members.length === 0 ? (
            <p className="text-sm text-muted">Belum ada anggota. <Link href="/settings/users" className="font-semibold text-brand underline">Undang anggota tim</Link>.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {members.map((m) => (
                <li key={m.id}>
                  <label className="flex min-h-11 items-center gap-3 rounded-lg border border-line-soft px-3 text-sm">
                    <input type="checkbox" name="members" value={m.id} defaultChecked={m.checked} className="size-4 accent-brand" />
                    <span className="truncate">{m.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </fieldset>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending="Menyimpan…">Simpan pengaturan</SubmitButton>
          {state.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
          {state.ok && <p role="status" className="text-sm text-ok">Tersimpan.</p>}
        </div>
      )}
    </form>
  );
}

export function WhatsAppControls({ id, coexistence, connected }: { id: string; coexistence: boolean; connected: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<FormState>({});
  const run = (fn: () => Promise<FormState>) => start(async () => setMsg(await fn()));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {coexistence && connected && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => retryCoexSync(id))}>
            Sinkron ulang kontak & riwayat
          </button>
        )}
        <Link href={`/connected-platforms/new/whatsapp?mode=${coexistence ? "coexistence" : "cloud_api"}`} className="btn btn-secondary btn-sm">
          {connected ? "Hubungkan ulang" : "Hubungkan lagi"}
        </Link>
        {connected && (
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled={pending}
            onClick={() => {
              if (confirm("Putuskan nomor ini? Pesan baru tidak akan masuk sampai dihubungkan lagi. Riwayat chat tetap tersimpan.")) run(() => disconnectWhatsApp(id));
            }}
          >
            Putuskan
          </button>
        )}
      </div>
      {msg.error && <p role="alert" className="text-sm text-bad">{msg.error}</p>}
      {msg.note && <p role="status" className="text-sm text-ok">{msg.note}</p>}
    </div>
  );
}

export function CreateLivechatForm() {
  const [state, action] = useActionState<FormState, FormData>(createLivechatInbox, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <label htmlFor="lc-name" className="label">Nama inbox</label>
        <input id="lc-name" name="name" className="field" placeholder="mis. Website toko" required minLength={2} maxLength={60} />
      </div>
      <SubmitButton pending="Membuat…">Buat inbox livechat</SubmitButton>
      {state.error && <p role="alert" className="basis-full text-sm text-bad">{state.error}</p>}
    </form>
  );
}
