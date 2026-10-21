import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera, Clapperboard, Globe, Mail, MessageCircle, Send, Server, Smartphone, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/page";
import type { Tone } from "@/components/nav";
import { PLATFORMS } from "@/lib/platforms";

export const metadata: Metadata = { title: "Inbox baru" };

/** Ikon generik per platform (lucide tidak menyediakan logo merek). */
const LOOK: Record<string, { icon: LucideIcon; tone: Tone }> = {
  "whatsapp-coexistence": { icon: Smartphone, tone: "ok" },
  "whatsapp-cloud": { icon: Server, tone: "ok" },
  livechat: { icon: Globe, tone: "sky" },
  instagram: { icon: Camera, tone: "rose" },
  messenger: { icon: MessageCircle, tone: "sky" },
  tiktok: { icon: Clapperboard, tone: "navy" },
  telegram: { icon: Send, tone: "sky" },
  email: { icon: Mail, tone: "amber" },
};

export default function NewInboxPage() {
  const ready = PLATFORMS.filter((p) => p.href);
  const soon = PLATFORMS.filter((p) => !p.href);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader nav="/connected-platforms" back={{ href: "/connected-platforms", label: "Platform terhubung" }} title="Pilih platform" description="Pilih platform tempat pesan pelanggan akan masuk ke inbox baru Anda." />

      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ready.map((p) => {
          const look = LOOK[p.id] ?? { icon: MessageCircle, tone: "brand" as Tone };
          const Icon = look.icon;
          return (
            <li key={p.id}>
              <Link href={p.href!} className="card card-hover group flex h-full flex-col gap-3 p-5">
                <span className="flex items-start justify-between gap-2">
                  <span className={`icon-tile icon-tile-lg tone-${look.tone}`}>
                    <Icon aria-hidden="true" className="size-6" />
                  </span>
                  {p.badge && <span className="badge badge-ok">{p.badge}</span>}
                </span>
                <span className="text-[17px] font-bold text-navy">{p.name}</span>
                <span className="text-sm leading-relaxed text-muted">{p.text}</span>
                <span className="mt-auto flex items-center gap-1.5 pt-2 text-sm font-semibold text-[#01606A]">
                  Hubungkan <ArrowRight aria-hidden="true" className="size-4 transition group-hover:translate-x-1" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      {soon.length > 0 && (
        <section aria-labelledby="h-soon" className="flex flex-col gap-3">
          <h2 id="h-soon" className="text-sm font-bold tracking-[0.06em] text-muted uppercase">Segera hadir</h2>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {soon.map((p) => {
              const look = LOOK[p.id] ?? { icon: MessageCircle, tone: "navy" as Tone };
              const Icon = look.icon;
              return (
                <li key={p.id} className="flex items-center gap-3 rounded-card border border-dashed border-line bg-white/60 p-4">
                  <span className={`icon-tile tone-${look.tone} opacity-70`}>
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold text-navy">{p.name}</span>
                    <span className="block text-[13px] text-muted">{p.text}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
