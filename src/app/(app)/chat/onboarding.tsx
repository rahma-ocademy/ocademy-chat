import { ExternalLink, Sparkles } from "lucide-react";
import type { SetupState } from "@/lib/inbox/queries";
import { StepList } from "@/components/page";
import { setupSteps } from "@/components/setup-steps";

/** Onboarding saat inbox kosong: langkah setup dihitung dari data nyata (lihat setup-steps.ts). */
export function Onboarding({ setup, widgetKey }: { setup: SetupState; widgetKey: string | null }) {
  const steps = setupSteps(setup);
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 p-5 sm:p-8">
        <div className="hero">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles aria-hidden="true" className="size-4" /> Mulai dalam beberapa menit
          </p>
          <h2 className="mt-1 text-2xl leading-tight font-bold sm:text-[28px]">Selamat datang di ocademy chat 👋</h2>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-white">
            Belum ada percakapan masuk. Selesaikan langkah di bawah agar pesan pelanggan langsung masuk ke inbox ini.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progres setup">
              <div className="h-full rounded-full bg-white transition-[width] duration-500" style={{ width: `${Math.max(pct, 4)}%` }} />
            </div>
            <span className="text-sm font-bold">{doneCount}/{steps.length} selesai</span>
          </div>
        </div>

        <StepList steps={steps} />

        {widgetKey && (
          <a
            href={`/w/${widgetKey}`}
            target="_blank"
            rel="noopener"
            className="card card-hover flex items-center gap-4 border-dashed p-4"
          >
            <span className="icon-tile tone-brand">
              <ExternalLink aria-hidden="true" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-navy">Coba sekarang</span>
              <span className="block text-sm text-muted">Buka widget livechat sebagai pelanggan dan kirim pesan uji. Pesannya muncul di sini secara realtime.</span>
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
