import type { Metadata } from "next";
import Link from "next/link";
import { isAdmin, requireContext } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { Notice, PageHeader } from "@/components/page";
import { graphVersion, metaConfig } from "@/lib/whatsapp/graph";
import { wabaQuotaError } from "@/lib/whatsapp/connect";
import { EmbeddedSignup, ManualConnectForm } from "./signup";

export const metadata: Metadata = { title: "Hubungkan WhatsApp" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STEPS = {
  coexistence: [
    { title: "Siapkan HP", text: "Buka app WhatsApp Business di HP dan pastikan sudah versi terbaru. Nomor tetap aktif di HP selama dan sesudah proses." },
    { title: "Login Meta & pilih bisnis", text: "Pilih (atau buat) Business Portfolio Meta. Isi website bisnis bila diminta agar akun tidak mudah dibatasi." },
    { title: "Hubungkan app WhatsApp Business", text: "Pilih opsi menghubungkan app WhatsApp Business yang sudah ada, masukkan nomor, lalu ikuti instruksi di HP." },
    { title: "Selesai", text: "Chat baru masuk ke inbox, balasan dari HP ikut tercatat, dan kontak serta riwayat chat disinkronkan bertahap." },
  ],
  cloud_api: [
    { title: "Siapkan nomor", text: "Gunakan nomor yang TIDAK sedang aktif di app WhatsApp/WhatsApp Business. Setelah terhubung, nomor hanya bisa dipakai lewat inbox ini." },
    { title: "Buat PIN 6 digit", text: "PIN verifikasi dua langkah untuk nomor ini. Simpan baik-baik; dibutuhkan bila nomor dipindah." },
    { title: "Login Meta & isi data bisnis", text: "Pilih Business Portfolio, buat akun WhatsApp Business, isi nama tampilan, lalu verifikasi nomor lewat OTP (SMS atau telepon)." },
    { title: "Selesai", text: "Nomor terdaftar di Cloud API dan pesan masuk langsung ke inbox. Atur metode pembayaran di Meta Business Suite bila melewati kuota gratis." },
  ],
} as const;

export default async function NewWhatsAppPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const mode = sp.mode === "cloud_api" ? "cloud_api" : "coexistence";
  const ctx = await requireContext();
  const quota = await wabaQuotaError(createSupabaseAdmin(), ctx.businessId);
  const cfg = metaConfig();
  const admin = isAdmin(ctx);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        nav="/connected-platforms"
        back={{ href: "/connected-platforms/new", label: "Pilih platform" }}
        title={mode === "coexistence" ? "WhatsApp Business App (Coexistence)" : "WhatsApp Business API (WABA)"}
        description={
          mode === "coexistence"
            ? "Nomor WhatsApp Business yang sudah ada tetap bisa dipakai di HP, sekaligus masuk ke inbox ini."
            : "Nomor khusus lewat WhatsApp Cloud API. Cocok untuk volume besar dan banyak agen."
        }
      />

      <nav aria-label="Pilih mode" className="flex flex-wrap gap-2">
        <Link href="?mode=coexistence" aria-current={mode === "coexistence" ? "page" : undefined} className={mode === "coexistence" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}>Coexistence</Link>
        <Link href="?mode=cloud_api" aria-current={mode === "cloud_api" ? "page" : undefined} className={mode === "cloud_api" ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}>WABA (Cloud API)</Link>
      </nav>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="card p-6" aria-labelledby="h-steps">
          <h2 id="h-steps" className="mb-4 text-lg font-bold text-navy">Langkahnya</h2>
          <ol className="flex flex-col gap-4">
            {STEPS[mode].map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-tint text-sm font-bold text-navy">{i + 1}</span>
                <div>
                  <p className="font-bold text-navy">{s.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
          {mode === "cloud_api" && (
            <div className="mt-5">
              <Notice tone="warn">
                Nomor yang dipindah ke WABA tidak bisa lagi dipakai di app WhatsApp di HP. Ingin tetap pakai HP? Pilih <Link href="?mode=coexistence" className="font-semibold underline">Coexistence</Link>.
              </Notice>
            </div>
          )}
        </section>

        <section className="card flex flex-col gap-4 p-6" aria-labelledby="h-connect">
          <h2 id="h-connect" className="text-lg font-bold text-navy">Hubungkan</h2>
          {!admin ? (
            <Notice tone="info">Hanya owner/admin yang bisa menghubungkan WhatsApp.</Notice>
          ) : quota ? (
            <Notice tone="warn">{quota} <Link href="/usage" className="font-semibold underline">Lihat paket</Link>.</Notice>
          ) : cfg ? (
            <EmbeddedSignup appId={cfg.appId} configId={cfg.configId} graphVersion={graphVersion()} mode={mode} />
          ) : (
            <Notice tone="info">
              Login Meta (Embedded Signup) belum dikonfigurasi. Isi <code>META_APP_ID</code>, <code>META_APP_SECRET</code>, dan <code>META_ES_CONFIG_ID</code> di server.
              {mode === "cloud_api" ? " Sementara itu, Anda bisa menghubungkan manual di bawah." : " Coexistence hanya bisa lewat Embedded Signup."}
            </Notice>
          )}
          {admin && !quota && mode === "cloud_api" && (
            <details className="border-t border-line-soft pt-4" open={!cfg}>
              <summary className="cursor-pointer text-sm font-semibold text-navy">Hubungkan manual (token System User)</summary>
              <p className="mt-2 mb-3 text-sm text-muted">Untuk nomor yang sudah terdaftar di Cloud API, misalnya nomor uji dari Meta App Dashboard.</p>
              <ManualConnectForm />
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
