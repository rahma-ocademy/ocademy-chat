import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { ArrowRight, Code, KeyRound, Plug, ShoppingBag, Webhook } from "lucide-react";
import { EmptyState, PageHeader, SectionCard } from "@/components/page";
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
        nav="/integrations"
        title="Integrasi & API"
        description="Hubungkan aplikasi pihak ketiga agar bisa membuat template follow-up, mengirim event, dan memicu pesan."
        actions={<Link href="/integrations/orderonline" className="btn btn-primary">Hubungkan OrderOnline</Link>}
      />

      <section aria-labelledby="h-int" className="flex flex-col gap-3">
        <h2 id="h-int" className="text-lg font-bold text-navy">Integrasi terhubung</h2>
        {integrations.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Plug}
              tone="navy"
              title="Belum ada integrasi"
              text="Hubungkan OrderOnline untuk mengimpor template follow-up, atau buat integrasi kustom lewat Open API di bawah."
              action={<Link href="/integrations/orderonline" className="btn btn-primary">Hubungkan OrderOnline</Link>}
            />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {integrations.map((i) => {
              const s = STATUS[i.status];
              const Icon = i.type === "orderonline" ? ShoppingBag : Webhook;
              return (
                <article key={i.id} className="card flex flex-col gap-3 p-5">
                  <div className="flex items-center gap-3">
                    <span className={`icon-tile icon-tile-lg ${i.type === "orderonline" ? "tone-amber" : "tone-navy"}`}>
                      <Icon aria-hidden="true" className="size-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[17px] font-bold text-navy">{i.name}</h3>
                      <span className={`${s.cls} mt-0.5`}>{s.label}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted">
                    {i.type === "orderonline" ? `Sinkron terakhir: ${when(i.last_synced_at)}` : "Integrasi kustom lewat Open API."}
                  </p>
                  {i.type === "orderonline" && (
                    <Link href="/integrations/orderonline" className="mt-auto flex items-center gap-1.5 text-sm font-semibold text-[#01606A] hover:underline">
                      Kelola &amp; sinkron template <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="h-keys" className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line-soft px-6 py-4">
          <span className="icon-tile icon-tile-sm tone-amber"><KeyRound aria-hidden="true" className="size-4" /></span>
          <h2 id="h-keys" className="text-[17px] font-bold text-navy">Kunci API</h2>
        </div>
        {apiKeys.length === 0 ? (
          <p className="px-6 py-6 text-sm text-muted">Belum ada kunci API. Buat integrasi kustom di bawah untuk mendapatkan kunci pertama.</p>
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

      <SectionCard id="h-new" title="Buat integrasi kustom" description="Dapatkan kunci API untuk aplikasi Anda sendiri." icon={Webhook} tone="navy">
        <CreateKeyForm />
      </SectionCard>

      <SectionCard id="h-doc" title="Contoh: kirim event dari aplikasi Anda" icon={Code} tone="sky">
        <div className="overflow-hidden rounded-xl bg-[#1E2A4D] shadow-inner">
          <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-[#FF6B6B]" />
            <span className="size-2.5 rounded-full bg-[#FFC94D]" />
            <span className="size-2.5 rounded-full bg-[#4CD98B]" />
            <span className="ml-2 font-mono text-[11px] text-[#AEB8D6]">terminal</span>
          </div>
        <pre className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-[#E8ECF7]">{`curl -X POST ${base}/api/v1/events \\
  -H "Authorization: Bearer ock_live_…" \\
  -H "Idempotency-Key: order-INV-0192-created" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "order.created",
    "contact": { "phone": "0812xxxxxxx", "name": "Rani" },
    "data": { "order_id": "INV-0192", "total": "Rp149.000",
              "payment_link": "https://bayar.contoh/INV-0192" }
  }'`}</pre>
        </div>
        <p className="hint">Event yang sama dengan Idempotency-Key yang sama tidak mengirim pesan dua kali. Template: <code className="font-mono">GET/POST {base}/api/v1/followup-templates</code>.</p>
      </SectionCard>
    </div>
  );
}
