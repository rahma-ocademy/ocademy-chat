import type { Scope } from "@/lib/apikeys";

// Dipisah dari forms.tsx / apikeys.ts: apikeys.ts "server-only", sedangkan daftar ini dipakai komponen klien.
export const SCOPES_INFO: { scope: Scope; desc: string; defaultOn: boolean }[] = [
  { scope: "templates:read", desc: "Membaca template follow-up", defaultOn: true },
  { scope: "templates:write", desc: "Membuat & mengubah template milik integrasi ini", defaultOn: false },
  { scope: "events:write", desc: "Mengirim event (order.created, dst.)", defaultOn: true },
  { scope: "messages:send", desc: "Mengirim follow-up langsung (segera)", defaultOn: false },
];
