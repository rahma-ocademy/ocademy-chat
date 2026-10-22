import { Bot, Link2, RadioTower, UserPlus, type LucideIcon } from "lucide-react";
import type { SetupState } from "@/lib/inbox/queries";
import { AI_AGENTS_ENABLED, type Tone } from "@/components/nav";

export type SetupStep = { title: string; text: string; done: boolean; href: string; cta: string; icon: LucideIcon; tone: Tone };

/** Urutan setup (pola Cekat): AI agent → platform → tim → AI ke inbox. Dipakai onboarding Inbox dan kartu progres di sidebar. */
export function setupSteps(s: SetupState): SetupStep[] {
  const steps: SetupStep[] = [
    { title: "Hubungkan platform", text: "WhatsApp (Coexistence/WABA) atau livechat untuk situs Anda.", done: s.hasInbox, href: "/connected-platforms/new", cta: "Hubungkan", icon: RadioTower, tone: "ok" },
    { title: "Buat AI agent", text: "Atur gaya bahasa dan pengetahuan bisnis untuk menjawab pelanggan.", done: s.hasAgent, href: "/ai-agents", cta: "Buat AI agent", icon: Bot, tone: "violet" },
    { title: "Undang tim", text: "Ajak rekan kerja ikut membalas chat.", done: s.hasTeam, href: "/settings/users", cta: "Undang tim", icon: UserPlus, tone: "rose" },
    { title: "Hubungkan AI ke inbox", text: "Pilih AI agent dan agen yang menangani tiap inbox.", done: s.hasAiInbox, href: "/connected-platforms", cta: "Atur inbox", icon: Link2, tone: "brand" },
  ];
  return AI_AGENTS_ENABLED ? steps : steps.filter((x) => x.href !== "/ai-agents" && x.title !== "Hubungkan AI ke inbox");
}
