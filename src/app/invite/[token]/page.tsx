import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { INVITE_TOKEN, hashInviteToken, inviteState, sameEmail } from "@/lib/team/invites";
import { ROLE_LABEL, type Role } from "@/lib/team/permissions";
import { logout } from "@/app/(auth)/actions";
import { AcceptButton } from "./accept";

export const metadata: Metadata = { title: "Undangan", robots: { index: false } };

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 px-6 py-10">
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="text-[26px] font-bold text-navy">ocademy</span>
        <span className="text-base font-medium text-brand">chat</span>
      </div>
      <Suspense fallback={<div className="card h-56 animate-pulse" aria-hidden="true" />}>
        <Invite params={params} />
      </Suspense>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-7">
      <h1 className="text-2xl font-bold text-navy">{title}</h1>
      {children}
    </section>
  );
}

async function Invite({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const invalid = (
    <Card title="Undangan tidak berlaku">
      <p className="text-sm text-muted">Link ini tidak valid, sudah dipakai, dibatalkan, atau kedaluwarsa. Minta link baru ke admin bisnis Anda.</p>
      <Link href="/login" className="btn btn-secondary">Ke halaman masuk</Link>
    </Card>
  );
  if (!INVITE_TOKEN.test(token)) return invalid;

  const admin = createSupabaseAdmin();
  const { data: inv } = await admin
    .from("invitations")
    .select("email, name, role, expires_at, accepted_at, revoked_at, businesses(name)")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!inv || inviteState(inv) !== "pending") return invalid;
  const biz = (Array.isArray(inv.businesses) ? inv.businesses[0] : inv.businesses) as { name: string } | null;

  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  const next = encodeURIComponent(`/invite/${token}`);

  return (
    <Card title={`Bergabung ke ${biz?.name ?? "bisnis"}`}>
      <p className="text-sm leading-relaxed text-muted">
        Halo {inv.name}, Anda diundang sebagai <strong className="text-navy">{ROLE_LABEL[inv.role as Role]}</strong> untuk email <strong className="text-navy">{inv.email}</strong>.
      </p>
      {!user ? (
        <div className="flex flex-col gap-2">
          <Link href={`/register?next=${next}&email=${encodeURIComponent(inv.email)}`} className="btn btn-primary">Buat akun & bergabung</Link>
          <Link href={`/login?next=${next}`} className="btn btn-secondary">Sudah punya akun? Masuk</Link>
        </div>
      ) : sameEmail(user.email, inv.email) ? (
        <AcceptButton token={token} />
      ) : (
        <div className="flex flex-col gap-3">
          <p role="alert" className="rounded-lg bg-bad-soft px-3.5 py-2.5 text-sm text-[#912018]">
            Anda masuk sebagai {user.email}. Undangan ini hanya untuk {inv.email}.
          </p>
          <form action={logout}>
            <button type="submit" className="btn btn-secondary w-full">Keluar dan masuk dengan email lain</button>
          </form>
        </div>
      )}
    </Card>
  );
}
