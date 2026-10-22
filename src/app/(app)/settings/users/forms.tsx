"use client";

import { useActionState, useState, useTransition } from "react";
import { CopyButton, SubmitButton } from "@/components/ui";
import { useResultToast, useToast } from "@/components/toast";
import { LEVEL_LABEL, LEVELS, PERMISSION_KEYS, PERMISSION_LABEL, type Permissions } from "@/lib/team/permissions";
import { inviteMember, resendInvite, revokeInvite, setMemberStatus, updateMember, type InviteResult } from "./actions";

function PermissionFields({ idPrefix, value }: { idPrefix: string; value?: Permissions }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="label">Izin global</legend>
      {PERMISSION_KEYS.map((k) => (
        <div key={k} className="grid gap-2 sm:grid-cols-[1fr_180px] sm:items-center">
          <label htmlFor={`${idPrefix}-${k}`} className="text-sm">
            <span className="font-semibold text-navy">{PERMISSION_LABEL[k].title}</span>
            <span className="block text-[13px] text-muted">{PERMISSION_LABEL[k].text}</span>
          </label>
          <select id={`${idPrefix}-${k}`} name={`perm_${k}`} className="field" defaultValue={value?.[k] ?? "none"}>
            {LEVELS.map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
        </div>
      ))}
    </fieldset>
  );
}

function InviteLink({ result }: { result: InviteResult }) {
  if (!result.link) return null;
  return (
    <div role="status" className="flex flex-col gap-2 rounded-xl border border-[#BFE5D8] bg-ok-soft p-4 text-sm text-ok">
      <p>
        Undangan untuk <strong>{result.email}</strong> dibuat. Kirim link ini ke yang bersangkutan (link hanya ditampilkan sekali):
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line-soft bg-white px-3 py-2 font-mono text-[12px] whitespace-nowrap text-navy">{result.link}</code>
        <CopyButton value={result.link} />
      </div>
    </div>
  );
}

export function InviteForm({ seatsFull }: { seatsFull: boolean }) {
  const [state, action] = useActionState<InviteResult, FormData>(inviteMember, {});
  useResultToast(state, "Undangan dibuat.");
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="inv-name" className="label">Nama</label>
          <input id="inv-name" name="name" className="field" required minLength={2} maxLength={80} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="inv-email" className="label">Email</label>
          <input id="inv-email" name="email" type="email" className="field" required autoComplete="off" />
        </div>
        <div>
          <label htmlFor="inv-role" className="label">Peran</label>
          <select id="inv-role" name="role" className="field" defaultValue="agent">
            <option value="agent">Agen — membalas chat</option>
            <option value="admin">Admin — juga mengatur platform & AI</option>
          </select>
        </div>
      </div>
      <PermissionFields idPrefix="inv" />
      {seatsFull && <p className="text-sm text-warn">Seat paket Anda sudah penuh. Batalkan undangan lain atau upgrade paket sebelum mengundang.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pending="Membuat undangan…">Buat undangan</SubmitButton>
      </div>
      <InviteLink result={state} />
    </form>
  );
}

export function InviteActions({ id, email }: { id: string; email: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<InviteResult>({});
  const [okText, setOkText] = useState("");
  useResultToast(result, okText);
  const run = (fn: () => Promise<InviteResult>, ok: string) =>
    start(async () => {
      setOkText(ok);
      setResult(await fn());
    });
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn btn-secondary btn-sm" disabled={pending} onClick={() => run(() => resendInvite(id), "Link undangan baru dibuat.")}>
          Buat link baru
        </button>
        <button
          type="button"
          className="btn btn-danger btn-sm"
          disabled={pending}
          onClick={() => {
            if (confirm(`Batalkan undangan untuk ${email}?`)) run(() => revokeInvite(id), "Undangan dibatalkan.");
          }}
        >
          Batalkan
        </button>
      </div>
      <div className="w-full max-w-md text-left"><InviteLink result={result} /></div>
    </div>
  );
}

export function MemberEditor({ userId, label, role, permissions }: { userId: string; label: string; role: "admin" | "agent"; permissions: Permissions }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<InviteResult, FormData>(updateMember, {});
  useResultToast(state, "Izin anggota diperbarui.");
  if (!open) {
    return <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)} aria-label={`Ubah izin ${label}`}>Ubah</button>;
  }
  return (
    <form action={action} className="flex w-full min-w-72 flex-col gap-4 rounded-xl border border-line-soft bg-bg p-4 text-left">
      <input type="hidden" name="user_id" value={userId} />
      <div>
        <label htmlFor={`role-${userId}`} className="label">Peran</label>
        <select id={`role-${userId}`} name="role" className="field" defaultValue={role}>
          <option value="agent">Agen</option>
          <option value="admin">Admin</option>
        </select>
      </div>
      <PermissionFields idPrefix={`m-${userId}`} value={permissions} />
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton pending="Menyimpan…" className="btn btn-primary btn-sm">Simpan</SubmitButton>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Tutup</button>
      </div>
    </form>
  );
}

export function MemberStatusButton({ userId, label, active }: { userId: string; label: string; active: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <span className="flex flex-col items-end gap-1">
      <button
        type="button"
        className={active ? "btn btn-danger btn-sm" : "btn btn-secondary btn-sm"}
        disabled={pending}
        onClick={() => {
          if (active && !confirm(`Nonaktifkan ${label}? Ia tidak bisa masuk ke bisnis ini lagi dan percakapannya dilepas.`)) return;
          start(async () => {
            const r = await setMemberStatus(userId, active ? "deactivated" : "active");
            if (r.error) toast.error(r.error);
            else toast.success(active ? `${label} dinonaktifkan.` : `${label} diaktifkan.`);
          });
        }}
      >
        {active ? "Nonaktifkan" : "Aktifkan"}
      </button>
    </span>
  );
}
