import type { Metadata } from "next";
import { hasPermission, requireContext } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { EmptyState, Notice, PageHeader } from "@/components/page";
import { inviteState } from "@/lib/team/invites";
import { LEVEL_LABEL, PERMISSION_KEYS, PERMISSION_LABEL, ROLE_LABEL, parsePermissions, type Role } from "@/lib/team/permissions";
import { seatUsage } from "@/lib/team/seats";
import { InviteForm, InviteActions, MemberEditor, MemberStatusButton } from "./forms";

export const metadata: Metadata = { title: "Pengguna" };

const date = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short", year: "numeric" });

export default async function UsersPage() {
  const ctx = await requireContext();
  if (!hasPermission(ctx, "user_management", "view")) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Pengguna" />
        <Notice tone="info">Anda tidak punya akses ke pengelolaan pengguna. Minta owner memberi izin “Pengguna”.</Notice>
      </div>
    );
  }
  const canManage = hasPermission(ctx, "user_management", "manage");
  const { supabase, businessId, user } = ctx;

  const [membersRes, invitesRes, seats] = await Promise.all([
    supabase.from("memberships").select("user_id, email, name, role, status, permissions, created_at").eq("business_id", businessId).order("created_at"),
    supabase
      .from("invitations")
      .select("id, email, name, role, expires_at, last_sent_at, accepted_at, revoked_at, created_at")
      .eq("business_id", businessId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
    seatUsage(createSupabaseAdmin(), businessId),
  ]);
  const members = (membersRes.data ?? []).map((m) => ({ ...m, role: m.role as Role, permissions: parsePermissions(m.permissions) }));
  const invites = invitesRes.data ?? [];
  const active = members.filter((m) => m.status === "active");
  const deactivated = members.filter((m) => m.status !== "active");
  const pending = invites.filter((i) => inviteState({ expires_at: i.expires_at, accepted_at: null, revoked_at: null }) === "pending");

  const stats = [
    { label: "Anggota aktif", value: active.length },
    { label: "Undangan pending", value: pending.length },
    { label: "Dinonaktifkan", value: deactivated.length },
    { label: "Seat terpakai", value: seats.limit === null ? `${seats.used}` : `${seats.used} / ${seats.limit}` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Pengguna" description="Undang anggota tim, atur peran dan izinnya, dan nonaktifkan akses bila perlu." />

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-bold text-navy">{s.value}</dd>
          </div>
        ))}
      </dl>

      {canManage && (
        <section className="card p-6" aria-labelledby="h-invite">
          <h2 id="h-invite" className="text-lg font-bold text-navy">Undang anggota</h2>
          <p className="mt-1 mb-4 text-sm text-muted">
            Anggota baru menerima link undangan (berlaku 7 hari). Admin bisa mengatur platform & AI agent; agen hanya membalas chat.
          </p>
          <InviteForm seatsFull={seats.limit !== null && seats.used >= seats.limit} />
        </section>
      )}

      <section className="card overflow-hidden" aria-labelledby="h-members">
        <h2 id="h-members" className="px-6 pt-5 pb-3 text-lg font-bold text-navy">Anggota</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Pengguna</th>
                <th scope="col">Peran</th>
                <th scope="col">Status</th>
                {PERMISSION_KEYS.map((k) => <th key={k} scope="col">{PERMISSION_LABEL[k].title}</th>)}
                {canManage && <th scope="col"><span className="sr-only">Aksi</span></th>}
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const editable = canManage && m.role !== "owner" && m.user_id !== user.id;
                const label = m.name || m.email || "Anggota";
                return (
                  <tr key={m.user_id}>
                    <th scope="row" className="font-normal">
                      <span className="block font-semibold text-navy">{label}{m.user_id === user.id ? " (Anda)" : ""}</span>
                      {m.name && m.email && <span className="text-[13px] text-muted">{m.email}</span>}
                    </th>
                    <td>{ROLE_LABEL[m.role]}</td>
                    <td><span className={m.status === "active" ? "badge badge-ok" : "badge badge-muted"}>{m.status === "active" ? "Aktif" : "Nonaktif"}</span></td>
                    {PERMISSION_KEYS.map((k) => (
                      <td key={k} className="text-muted">{m.role === "owner" ? LEVEL_LABEL.manage : LEVEL_LABEL[m.permissions[k]]}</td>
                    ))}
                    {canManage && (
                      <td className="text-right">
                        {editable && (
                          <div className="flex flex-wrap justify-end gap-2">
                            <MemberEditor userId={m.user_id} label={label} role={m.role === "admin" ? "admin" : "agent"} permissions={m.permissions} />
                            <MemberStatusButton userId={m.user_id} label={label} active={m.status === "active"} />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card overflow-hidden" aria-labelledby="h-invites">
        <h2 id="h-invites" className="px-6 pt-5 pb-3 text-lg font-bold text-navy">Undangan</h2>
        {invites.length === 0 ? (
          <EmptyState title="Tidak ada undangan terbuka" text="Undangan yang belum diterima akan muncul di sini." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Peran</th>
                  <th scope="col">Status</th>
                  <th scope="col">Berlaku sampai</th>
                  {canManage && <th scope="col"><span className="sr-only">Aksi</span></th>}
                </tr>
              </thead>
              <tbody>
                {invites.map((i) => {
                  const st = inviteState({ expires_at: i.expires_at, accepted_at: null, revoked_at: null });
                  return (
                    <tr key={i.id}>
                      <th scope="row" className="font-normal">
                        <span className="block font-semibold text-navy">{i.name}</span>
                        <span className="text-[13px] text-muted">{i.email}</span>
                      </th>
                      <td>{ROLE_LABEL[i.role as Role]}</td>
                      <td><span className={st === "pending" ? "badge badge-warn" : "badge badge-muted"}>{st === "pending" ? "Menunggu" : "Kedaluwarsa"}</span></td>
                      <td className="text-muted">{date(i.expires_at)}</td>
                      {canManage && <td className="text-right"><InviteActions id={i.id} email={i.email} /></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
