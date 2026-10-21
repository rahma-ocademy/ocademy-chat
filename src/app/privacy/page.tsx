import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { LegalFooter } from "@/components/legal-footer";

export const metadata: Metadata = {
  title: "Kebijakan Privasi",
  description: "Bagaimana ocademy chat mengumpulkan, memakai, menyimpan, dan menghapus data.",
};

const UPDATED = "21 Oktober 2026";
const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

const SECTIONS = [
  { id: "data", title: "Data yang kami kumpulkan" },
  { id: "penggunaan", title: "Cara kami memakai data" },
  { id: "pihak-ketiga", title: "Layanan pihak ketiga" },
  { id: "meta", title: "Data dari Meta (WhatsApp)" },
  { id: "penyimpanan", title: "Penyimpanan & keamanan" },
  { id: "hak", title: "Hak Anda" },
  { id: "hapus-data", title: "Penghapusan data" },
  { id: "perubahan", title: "Perubahan kebijakan" },
  { id: "kontak", title: "Hubungi kami" },
];

function Contact() {
  return CONTACT ? (
    <a href={`mailto:${CONTACT}`} className="font-semibold text-[#01606A] underline">{CONTACT}</a>
  ) : (
    <a href="https://ocademy.id" className="font-semibold text-[#01606A] underline">ocademy.id</a>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <header className="bg-brand-gradient text-white">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-6 py-12">
          <Link href="/" className="flex w-fit items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-white">
            <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl bg-white text-lg font-bold text-navy">o</span>
            <span className="flex items-baseline gap-1">
              <span className="text-[19px] font-bold">ocademy</span>
              <span className="text-sm font-semibold">chat</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <ShieldCheck aria-hidden="true" className="size-8 shrink-0" />
            <h1 className="text-[32px] leading-tight font-bold">Kebijakan Privasi</h1>
          </div>
          <p className="max-w-2xl text-[15px] leading-relaxed text-white">
            Kebijakan ini menjelaskan bagaimana ocademy chat (“kami”), layanan dari ocademy.id, mengumpulkan, memakai, menyimpan, dan menghapus
            data saat Anda memakai aplikasi, widget livechat, dan integrasi WhatsApp.
          </p>
          <p className="text-sm text-white">Terakhir diperbarui: {UPDATED}</p>
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl gap-8 px-6 py-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="Daftar isi" className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-2 text-xs font-bold tracking-[0.08em] text-muted uppercase">Daftar isi</p>
          <ol className="flex flex-col gap-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-md px-2 py-1 text-ink hover:bg-tint hover:text-navy">{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="card flex flex-col gap-8 p-6 text-[15px] leading-relaxed text-ink sm:p-8 [&_h2]:mb-2 [&_h2]:scroll-mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-navy [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
          <section>
            <h2 id="data">1. Data yang kami kumpulkan</h2>
            <ul>
              <li><strong>Data akun:</strong> nama bisnis, email, dan kata sandi (disimpan dalam bentuk hash oleh penyedia autentikasi kami).</li>
              <li><strong>Data tim:</strong> email anggota yang Anda undang, peran, dan hak aksesnya.</li>
              <li><strong>Data percakapan:</strong> nama, nomor telepon, dan email kontak, isi pesan, label, catatan internal, serta waktu pesan, yang masuk lewat WhatsApp atau widget livechat.</li>
              <li><strong>Data integrasi:</strong> token akses WhatsApp Business dan OrderOnline, ID akun WhatsApp Business, nomor telepon bisnis, serta data pesanan yang dikirim OrderOnline lewat webhook (mis. nomor pesanan, nama dan nomor pembeli, status pembayaran dan pengiriman).</li>
              <li><strong>Konfigurasi:</strong> template pesan, aturan follow-up, dan pengaturan AI agent yang Anda buat.</li>
              <li><strong>Data teknis:</strong> cookie sesi untuk menjaga Anda tetap masuk, dan token pengunjung widget livechat yang disimpan di browser pengunjung.</li>
            </ul>
          </section>

          <section>
            <h2 id="penggunaan">2. Cara kami memakai data</h2>
            <ul>
              <li>Menampilkan dan mengirim pesan antara bisnis Anda dan pelanggannya.</li>
              <li>Menjalankan follow-up otomatis dan template sesuai aturan yang Anda atur.</li>
              <li>Menyinkronkan template dan event pesanan dari integrasi yang Anda hubungkan.</li>
              <li>Mengelola akun, tim, hak akses, dan kuota pemakaian.</li>
              <li>Menjaga keamanan layanan dan menyelidiki penyalahgunaan.</li>
            </ul>
            <p className="mt-3">Kami <strong>tidak menjual</strong> data Anda maupun data pelanggan Anda, dan tidak memakainya untuk iklan.</p>
          </section>

          <section>
            <h2 id="pihak-ketiga">3. Layanan pihak ketiga</h2>
            <p>Kami memakai penyedia berikut untuk menjalankan layanan. Mereka hanya memproses data sejauh diperlukan untuk fungsi tersebut:</p>
            <ul className="mt-2">
              <li><strong>Supabase:</strong> basis data, autentikasi, dan realtime.</li>
              <li><strong>Vercel:</strong> hosting aplikasi.</li>
              <li><strong>Meta Platforms (WhatsApp Business Platform):</strong> mengirim dan menerima pesan WhatsApp.</li>
              <li><strong>OrderOnline:</strong> bila Anda menghubungkannya, untuk mengambil template dan menerima event pesanan.</li>
            </ul>
          </section>

          <section>
            <h2 id="meta">4. Data dari Meta (WhatsApp)</h2>
            <p>
              Saat Anda menghubungkan WhatsApp lewat login Meta (Embedded Signup), kami menerima ID akun WhatsApp Business, ID dan nomor telepon
              bisnis, serta token akses dengan izin <code className="font-mono text-sm">whatsapp_business_management</code> dan{" "}
              <code className="font-mono text-sm">whatsapp_business_messaging</code>. Data ini hanya dipakai untuk mengirim dan menerima pesan bisnis Anda
              di ocademy chat, tidak dipakai untuk tujuan lain, dan tidak dibagikan ke pihak lain di luar daftar di atas.
            </p>
          </section>

          <section>
            <h2 id="penyimpanan">5. Penyimpanan & keamanan</h2>
            <ul>
              <li>Koneksi ke aplikasi memakai HTTPS.</li>
              <li>Token integrasi (WhatsApp, OrderOnline) disimpan <strong>terenkripsi</strong> dan tidak pernah ditampilkan lagi setelah disimpan.</li>
              <li>Data setiap bisnis dipisahkan dengan kontrol akses di tingkat basis data, sehingga anggota hanya bisa melihat data bisnisnya sendiri.</li>
              <li>Data disimpan selama akun Anda aktif, atau sampai Anda meminta penghapusan.</li>
            </ul>
          </section>

          <section>
            <h2 id="hak">6. Hak Anda</h2>
            <p>Anda dapat meminta untuk melihat, membetulkan, mengekspor, atau menghapus data Anda. Pemilik bisnis juga dapat memutus integrasi WhatsApp atau OrderOnline kapan saja dari menu Platform terhubung dan Integrasi & API; token terkait akan dihapus dari sistem kami.</p>
          </section>

          <section>
            <h2 id="hapus-data">7. Penghapusan data</h2>
            <p>Untuk menghapus akun dan seluruh data bisnis Anda (termasuk data yang kami terima dari Meta):</p>
            <ol className="mt-2 ml-5 flex list-decimal flex-col gap-1.5">
              <li>Putuskan integrasi WhatsApp di <strong>Platform terhubung</strong> dan integrasi lain di <strong>Integrasi & API</strong>.</li>
              <li>Kirim permintaan penghapusan ke <Contact /> dari email akun Anda, dengan menyebut nama bisnis.</li>
              <li>Kami menghapus akun, percakapan, kontak, template, aturan, dan token terkait dalam waktu paling lama 30 hari, lalu mengonfirmasi lewat email.</li>
            </ol>
            <p className="mt-3">Anda juga dapat mencabut akses ocademy chat dari pengaturan Facebook/Meta Business Anda kapan saja.</p>
          </section>

          <section>
            <h2 id="perubahan">8. Perubahan kebijakan</h2>
            <p>Kami dapat memperbarui kebijakan ini. Tanggal “Terakhir diperbarui” di atas akan berubah, dan perubahan penting akan kami beritahukan di dalam aplikasi.</p>
          </section>

          <section>
            <h2 id="kontak">9. Hubungi kami</h2>
            <p>Pertanyaan tentang privasi atau data Anda dapat dikirim ke <Contact />.</p>
          </section>
        </article>
      </div>

      <LegalFooter className="pb-10" />
    </div>
  );
}
