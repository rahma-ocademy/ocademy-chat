// Katalog platform di dialog "Inbox baru" (pola Cekat: daftar statis di frontend).
// `href` null = belum tersedia; tetap ditampilkan agar pengguna tahu yang direncanakan.

export type Platform = {
  id: string;
  name: string;
  text: string;
  href: string | null;
  badge?: string;
};

export const PLATFORMS: Platform[] = [
  {
    id: "whatsapp-coexistence",
    name: "WhatsApp Business App (Coexistence)",
    text: "Pakai nomor WhatsApp Business yang sudah ada. Tetap bisa membalas dari HP, dan semua chat juga masuk ke inbox ini.",
    href: "/connected-platforms/new/whatsapp?mode=coexistence",
    badge: "Disarankan",
  },
  {
    id: "whatsapp-cloud",
    name: "WhatsApp Business API (WABA)",
    text: "Nomor khusus API lewat Meta. Nomor tidak bisa lagi dipakai di aplikasi WhatsApp di HP.",
    href: "/connected-platforms/new/whatsapp?mode=cloud_api",
  },
  {
    id: "livechat",
    name: "Web Live Chat",
    text: "Widget chat untuk situs web atau link yang bisa dibagikan.",
    href: "/connected-platforms/new/livechat",
  },
  { id: "instagram", name: "Instagram", text: "DM Instagram.", href: null },
  { id: "messenger", name: "Messenger", text: "Pesan Facebook Page.", href: null },
  { id: "tiktok", name: "TikTok", text: "Pesan TikTok.", href: null },
  { id: "telegram", name: "Telegram", text: "Bot Telegram.", href: null },
  { id: "email", name: "Email", text: "Gmail atau email lain.", href: null },
];

export const INBOX_TYPE_LABEL: Record<string, string> = { livechat: "Web Live Chat", whatsapp: "WhatsApp", api: "API" };

export const MODE_LABEL: Record<string, string> = { cloud_api: "WABA (Cloud API)", coexistence: "Coexistence" };

export const STATUS_BADGE: Record<string, { cls: string; label: string }> = {
  connected: { cls: "badge badge-ok", label: "Terhubung" },
  pending: { cls: "badge badge-warn", label: "Menunggu" },
  error: { cls: "badge badge-bad", label: "Bermasalah" },
  disconnected: { cls: "badge badge-muted", label: "Terputus" },
};
