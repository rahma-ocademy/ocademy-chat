import { Bot, MessagesSquare, Zap } from "lucide-react";
import { LegalFooter } from "@/components/legal-footer";

const POINTS = [
  { icon: MessagesSquare, title: "Satu inbox untuk semua chat", text: "WhatsApp dan livechat masuk ke satu tempat, dibalas bersama tim." },
  { icon: Zap, title: "Follow-up otomatis", text: "Pesan lanjutan terkirim sendiri saat ada order, pembayaran, atau pengiriman." },
  { icon: Bot, title: "Dibantu AI agent", text: "AI menjawab pertanyaan umum, tim fokus ke yang penting." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="bg-brand-gradient relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <span aria-hidden="true" className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10" />
        <span aria-hidden="true" className="absolute -bottom-32 -left-16 size-96 rounded-full bg-accent/20" />

        <div className="relative flex items-center gap-2.5">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-xl bg-white text-xl font-bold text-navy">o</span>
          <span className="flex items-baseline gap-1">
            <span className="text-[22px] font-bold">ocademy</span>
            <span className="text-base font-semibold">chat</span>
          </span>
        </div>

        <div className="relative flex max-w-lg flex-col gap-8">
          <h2 className="text-[34px] leading-tight font-bold">Balas pelanggan lebih cepat, jual lebih banyak.</h2>

          {/* Mockup percakapan: dekoratif. */}
          <div aria-hidden="true" className="flex flex-col gap-2.5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur-sm">
            <p className="max-w-[80%] self-start rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-sm text-ink shadow">Kak, pesanan saya sudah dikirim?</p>
            <p className="max-w-[80%] self-end rounded-2xl rounded-br-md bg-[#E2F5F7] px-3.5 py-2 text-sm text-ink shadow">Sudah ya Kak, resinya JNE 0123…. Estimasi tiba besok 🙌</p>
            <p className="flex items-center gap-1.5 self-end text-xs font-semibold text-white">
              <Zap className="size-3.5" /> Follow-up otomatis terkirim
            </p>
          </div>

          <ul className="flex flex-col gap-4">
            {POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <li key={p.title} className="flex gap-3.5">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span>
                    <span className="block font-bold">{p.title}</span>
                    <span className="block text-sm leading-relaxed text-white">{p.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <LegalFooter tone="light" className="relative !justify-start" />
      </aside>

      <main className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        <div className="flex items-center gap-2.5 lg:hidden">
          <span aria-hidden="true" className="bg-brand-gradient flex size-10 items-center justify-center rounded-xl text-xl font-bold text-white">o</span>
          <span className="flex items-baseline gap-1">
            <span className="text-[24px] font-bold text-navy">ocademy</span>
            <span className="text-base font-semibold text-brand">chat</span>
          </span>
        </div>
        <div className="w-full max-w-md">{children}</div>
        <LegalFooter className="lg:hidden" />
      </main>
    </div>
  );
}
