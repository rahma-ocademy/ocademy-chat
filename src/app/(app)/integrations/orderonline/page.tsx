import type { Metadata } from "next";
import Link from "next/link";
import { requireContext } from "@/lib/auth";
import { Notice, PageHeader } from "@/components/page";
import { CopyButton } from "@/components/ui";
import { ConnectOrderOnlineForm, OrderOnlineActions } from "../forms";

export const metadata: Metadata = { title: "OrderOnline" };

export default async function OrderOnlinePage() {
  const { supabase, businessId } = await requireContext();
  const { data: integ } = await supabase
    .from("integrations")
    .select("id, status, webhook_secret, last_synced_at")
    .eq("business_id", businessId)
    .eq("type", "orderonline")
    .maybeSingle();

  const partnerKeyMissing = !process.env.ORDERONLINE_PARTNER_API_KEY;
  const connected = integ && integ.status !== "disconnected";

  const [tpls, rules, active] = integ
    ? await Promise.all([
        supabase.from("followup_templates").select("id", { count: "exact", head: true }).eq("integration_id", integ.id),
        supabase.from("followup_rules").select("id", { count: "exact", head: true }).eq("integration_id", integ.id),
        supabase.from("followup_rules").select("id", { count: "exact", head: true }).eq("integration_id", integ.id).eq("active", true),
      ])
    : [null, null, null];

  const webhookUrl = integ ? `${process.env.NEXT_PUBLIC_APP_URL ?? "https://[DOMAIN-APP]"}/api/webhooks/orderonline/${integ.webhook_secret}` : "";
  const synced = integ?.last_synced_at
    ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(integ.last_synced_at))
    : "belum pernah";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/integrations" className="btn btn-secondary btn-sm self-start">← Integrasi &amp; API</Link>
      <PageHeader
        title="OrderOnline"
        description="Impor template follow-up & pengiriman dari OrderOnline, terima event order lewat webhook, lalu kirim follow-up dari sini."
      />

      {partnerKeyMissing && (
        <Notice tone="warn">
          <strong>Prasyarat:</strong> integrasi ini butuh <em>Partner API key</em> dari OrderOnline (env <code>ORDERONLINE_PARTNER_API_KEY</code>). Kunci ini hanya diberikan kepada partner resmi.
        </Notice>
      )}

      {!connected ? (
        <section className="card flex flex-col gap-5 p-6" aria-labelledby="h-connect">
          <h2 id="h-connect" className="text-lg font-bold text-navy">Hubungkan akun</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
            <li>Di dashboard OrderOnline, buat atau salin <strong>Open API Token</strong>.</li>
            <li>Tempel di bawah, lalu hubungkan.</li>
            <li>Setelah terhubung, pasang <strong>URL webhook</strong> yang muncul di dashboard OrderOnline (cakupan <code className="font-mono">order:*</code>).</li>
          </ol>
          <ConnectOrderOnlineForm />
        </section>
      ) : (
        <>
          <section className="card flex flex-wrap items-center gap-x-8 gap-y-3 p-5" aria-label="Status">
            <div>
              <p className="text-sm text-muted">Status</p>
              <p className={`badge mt-1 ${integ.status === "connected" ? "badge-ok" : "badge-bad"}`}>{integ.status === "connected" ? "Terhubung" : "Bermasalah — coba sinkron ulang"}</p>
            </div>
            <div><p className="text-sm text-muted">Sinkron terakhir</p><p className="mt-1 font-bold text-navy">{synced}</p></div>
            <div><p className="text-sm text-muted">Template</p><p className="mt-1 font-bold text-navy">{tpls?.count ?? 0}</p></div>
            <div><p className="text-sm text-muted">Aturan (aktif / total)</p><p className="mt-1 font-bold text-navy">{active?.count ?? 0} / {rules?.count ?? 0}</p></div>
          </section>

          <Notice tone="warn">
            <strong>Risiko pesan ganda:</strong> aturan hasil impor dibuat <em>nonaktif</em>. Sebelum mengaktifkan satu aturan di{" "}
            <Link href="/followups" className="font-semibold underline">Followups</Link>, matikan auto-WA yang sama di OrderOnline — API OrderOnline tidak menyediakan cara mematikannya dari sini.
          </Notice>

          <section className="card flex flex-col gap-3 p-6" aria-labelledby="h-wh">
            <h2 id="h-wh" className="text-lg font-bold text-navy">URL webhook</h2>
            <p className="text-sm leading-relaxed text-muted">Pasang URL ini di OrderOnline dengan cakupan <code className="font-mono text-navy">order:*</code>. URL ini rahasia: siapa pun yang memilikinya bisa mengirim event ke akun Anda.</p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-line-soft bg-bg px-3.5 py-3 font-mono text-[13px] whitespace-nowrap text-navy">{webhookUrl}</code>
              <CopyButton value={webhookUrl} label="Salin URL" />
            </div>
          </section>

          <section className="card p-6" aria-labelledby="h-act">
            <h2 id="h-act" className="mb-4 text-lg font-bold text-navy">Kelola koneksi</h2>
            <OrderOnlineActions />
          </section>
        </>
      )}
    </div>
  );
}
