import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { PageHeader } from "@/components/page";
import type { IntegrationRow } from "@/lib/types";
import { CreateKeyForm, RevokeButton } from "./forms";

export const metadata: Metadata = { title: "Integrasi & API" };

const when = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso)) : "—";

const STATUS = {
  connected: { cls: "badge badge-ok", label: "Terhubung" },
  error: { cls: "badge badge-bad", label: "Bermasalah" },
  disconnected: { cls: "badge badge-muted", label: "Terputus" },
} as const;

export default async function IntegrationsPage() {
  const { supabase, businessId } = await requireContext();
  const [integ, keys] = await Promise.all([
    supabase.from("integrations").select("id, type, name, status, last_synced_at, created_at").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase.from("api_keys").select("id, name, key_prefix, scopes, last_used_at, revoked_at, created_at, integration_id").eq("business_id", businessId).order("created_at", { ascending: false }),
  ]);
  const integrations = (integ.data ?? []) as IntegrationRow[];
  const apiKeys = keys.data ?? [];
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://[DOMAIN-APP]";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Integrasi & API"
        description="Hubungkan aplikasi pihak ketiga agar bisa membuat template follow-up, mengirim event, dan memicu pesan."
        actions={<Link href="/integrations/orderonline" className="btn btn-primary">Hubungkan OrderOnline</Link>}
      />

      <section aria-labelledby="h-int" className="grid gap-4 md:grid-cols-2">
        <h2 id="h-int" className="sr-only">Integrasi terhubung</h2>
        {integrations.length === 0 && (
          <p className="card col-span-full p-6 text-sm text-muted">Belum ada integrasi. Hubungkan OrderOnline, atau buat integrasi kustom di bawah.</p>
        )}
        {integrations.map((i) => {
          const s = STATUS[i.status];
          return (
            <article key={i.id} className="card flex flex-col gap-3 p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-[17px] font-bold text-navy">{i.name}</h3>
                <span className={s.cls}>{s.label}</span>
              </div>
              <p className="text-sm text-muted">
                {i.type === "orderonline" ? `Sinkron terakhir: ${when(i.last_synced_at)}` : "Integrasi kustom lewat Open API."}
              </p>
              {i.type === "orderonline" && (
                <Link href="/integrations/orderonline" className="btn btn-secondary btn-sm self-start">Kelola &amp; sinkron template</Link>
              )}
            </article>
          );
        })}
      </section>

      <section aria-labelledby="h-keys" className="card overflow-hidden">
        <div className="border-b border-line-soft px-5 py-4">
          <h2 id="h-keys" className="text-lg font-bold text-navy">Kunci API</h2>
        </div>
        {apiKeys.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">Belum ada kunci API.</p>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[720px]">
              <thead><tr><th scope="col">Nama</th><th scope="col">Kunci</th><th scope="col">Izin</th><th scope="col">Terakhir dipakai</th><th scope="col"><span className="sr-only">Aksi</span></th></tr></thead>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.id} className={k.revoked_at ? "opacity-55" : undefined}>
                    <td className="font-bold text-navy">{k.name}{k.revoked_at && <span className="badge badge-muted ml-2">Dicabut</span>}</td>
                    <td><code className="font-mono text-[13px]">{k.key_prefix}••••••••</code></td>
                    <td><p className="flex flex-wrap gap-1">{(k.scopes as string[]).map((s) => <code key={s} className="rounded bg-tint px-1.5 py-0.5 font-mono text-[11px] text-navy">{s}</code>)}</p></td>
                    <td className="text-muted">{when(k.last_used_at)}</td>
                    <td className="text-right">{!k.revoked_at && <RevokeButton id={k.id} name={k.name} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="h-new" className="card p-6">
        <h2 id="h-new" className="mb-4 text-lg font-bold text-navy">Buat integrasi kustom</h2>
        <CreateKeyForm />
      </section>

      <section aria-labelledby="h-doc" className="card p-6">
        <h2 id="h-doc" className="mb-3 text-lg font-bold text-navy">Contoh: kirim event dari aplikasi Anda</h2>
        <pre className="overflow-x-auto rounded-xl bg-[#1E2A4D] p-4 font-mono text-[13px] leading-relaxed text-[#E8ECF7]">{`curl -X POST ${base}/api/v1/events \\
  -H "Authorization: Bearer ock_live_…" \\
  -H "Idempotency-Key: order-INV-0192-created" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "order.created",
    "contact": { "phone": "0812xxxxxxx", "name": "Rani" },
    "data": { "order_id": "INV-0192", "total": "Rp149.000",
              "payment_link": "https://bayar.contoh/INV-0192" }
  }'`}</pre>
        <p className="hint">Event yang sama dengan Idempotency-Key yang sama tidak mengirim pesan dua kali. Template: <code className="font-mono">GET/POST {base}/api/v1/followup-templates</code>.</p>
      </section>
    </div>
  );
}
