import Link from "next/link";
import type { SetupState } from "@/lib/inbox/queries";

/** Onboarding saat inbox kosong — urutan setup sama dengan Cekat (AI agent → platform → tim → AI ke inbox). */
export function Onboarding({ setup, widgetKey }: { setup: SetupState; widgetKey: string | null }) {
  const steps = [
    { title: "Buat AI agent", text: "Atur gaya bahasa dan pengetahuan bisnis untuk menjawab pelanggan.", done: setup.hasAgent, href: "/ai-agents", cta: "Buat AI agent" },
    { title: "Hubungkan platform", text: "Hubungkan WhatsApp (Coexistence atau WABA) atau buat livechat.", done: setup.hasInbox, href: "/connected-platforms/new", cta: "Hubungkan" },
    { title: "Undang agen manusia", text: "Ajak tim Anda ikut membalas chat.", done: setup.hasTeam, href: "/settings/users", cta: "Undang tim" },
    { title: "Hubungkan AI agent ke inbox", text: "Pilih AI agent dan agen yang menangani tiap inbox.", done: setup.hasAiInbox, href: "/connected-platforms", cta: "Atur inbox" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-navy">Selamat datang di ocademy chat!</h2>
        <p className="mt-1 text-sm text-muted">{doneCount} dari 4 langkah selesai. Belum ada percakapan masuk.</p>
      </div>
      <ol className="flex w-full max-w-lg flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.title} className="card flex items-start gap-4 p-4">
            <span
              aria-hidden="true"
              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.done ? "bg-ok-soft text-ok" : "bg-tint text-navy"}`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-navy">
                {s.title} {s.done && <span className="sr-only">(selesai)</span>}
              </p>
              <p className="mt-0.5 text-sm text-muted">{s.text}</p>
            </div>
            {!s.done && <Link href={s.href} className="btn btn-secondary btn-sm shrink-0">{s.cta}</Link>}
          </li>
        ))}
      </ol>
      {widgetKey && (
        <p className="text-sm text-muted">
          Ingin mencoba sekarang?{" "}
          <a href={`/w/${widgetKey}`} target="_blank" rel="noopener" className="font-semibold text-brand underline">Kirim pesan uji lewat widget livechat ↗</a>
        </p>
      )}
    </div>
  );
}
