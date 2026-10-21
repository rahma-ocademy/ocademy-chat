import Link from "next/link";

/** Footer kecil berisi tautan Kebijakan Privasi (dibutuhkan Meta App & dipakai di semua halaman publik). */
export function LegalFooter({ tone = "muted", className = "" }: { tone?: "muted" | "light"; className?: string }) {
  const text = tone === "light" ? "text-white" : "text-muted";
  const link = tone === "light" ? "text-white underline-offset-2 hover:underline" : "font-semibold text-[#01606A] underline-offset-2 hover:underline";
  return (
    <footer className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs ${text} ${className}`}>
      {/* Tanpa tahun dinamis: new Date() saat prerender memicu galat "unstable value" (Cache Components). */}
      <span>© ocademy.id</span>
      <span aria-hidden="true">·</span>
      <Link href="/privacy" className={link}>Kebijakan Privasi</Link>
      <span aria-hidden="true">·</span>
      <Link href="/privacy#hapus-data" className={link}>Penghapusan data</Link>
    </footer>
  );
}
