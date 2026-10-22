import { Bot, FileText, Gauge, MessagesSquare, Plug, RadioTower, Users, Zap, type LucideIcon } from "lucide-react";

/** Menu AI agent disembunyikan sementara (belum dibutuhkan). Ubah ke true untuk menampilkannya lagi. */
export const AI_AGENTS_ENABLED = false;

export type Tone = "brand" | "navy" | "violet" | "amber" | "sky" | "rose" | "ok";

export type NavItem = {
  href: string;
  label: string;
  /** Satu kalimat: dipakai sebagai tooltip saat sidebar diciutkan dan sebagai sub-judul halaman. */
  hint: string;
  icon: LucideIcon;
  tone: Tone;
};

export type NavGroup = { label: string | null; items: NavItem[] };

/** Satu sumber menu: sidebar, judul top bar, dan ikon di header halaman membaca dari sini. */
const ALL_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/chat", label: "Inbox", hint: "Baca dan balas semua percakapan pelanggan", icon: MessagesSquare, tone: "brand" }],
  },
  {
    label: "Otomasi",
    items: [
      { href: "/ai-agents", label: "AI agent", hint: "Atur AI yang membantu menjawab pelanggan", icon: Bot, tone: "violet" },
      { href: "/followups", label: "Follow-up otomatis", hint: "Kirim pesan lanjutan otomatis sesuai event", icon: Zap, tone: "amber" },
      { href: "/templates", label: "Template pesan", hint: "Pesan siap pakai untuk follow-up", icon: FileText, tone: "sky" },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      { href: "/connected-platforms", label: "Platform terhubung", hint: "Hubungkan WhatsApp dan livechat", icon: RadioTower, tone: "ok" },
      { href: "/settings/users", label: "Tim & pengguna", hint: "Undang tim dan atur hak akses", icon: Users, tone: "rose" },
      { href: "/integrations", label: "Integrasi & API", hint: "OrderOnline, API key, dan webhook", icon: Plug, tone: "navy" },
      { href: "/usage", label: "Paket & pemakaian", hint: "Kuota bulanan dan fitur paket", icon: Gauge, tone: "brand" },
    ],
  },
];

const AI_HREF = "/ai-agents";
export const NAV: NavGroup[] = ALL_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => AI_AGENTS_ENABLED || i.href !== AI_HREF) }));

// Halaman yang disembunyikan tetap dikenali (judul/ikon header) bila dibuka lewat URL langsung.
const ALL = ALL_GROUPS.flatMap((g) => g.items.map((item) => ({ item, group: g.label })));

export const isActive = (pathname: string, href: string) => Boolean(pathname) && (pathname === href || pathname.startsWith(`${href}/`));

export function findNav(pathname: string) {
  return ALL.find(({ item }) => isActive(pathname, item.href)) ?? null;
}

/** Pintasan "+ Baru" di top bar. */
const QUICK_CREATE_ALL = [
  { href: "/connected-platforms/new", label: "Inbox / platform", icon: RadioTower, tone: "ok" as Tone },
  { href: "/followups/new", label: "Follow-up otomatis", icon: Zap, tone: "amber" as Tone },
  { href: "/templates", label: "Template pesan", icon: FileText, tone: "sky" as Tone },
  { href: "/ai-agents", label: "AI agent", icon: Bot, tone: "violet" as Tone },
  { href: "/settings/users", label: "Undang anggota tim", icon: Users, tone: "rose" as Tone },
];
export const QUICK_CREATE = QUICK_CREATE_ALL.filter((q) => AI_AGENTS_ENABLED || q.href !== AI_HREF);
