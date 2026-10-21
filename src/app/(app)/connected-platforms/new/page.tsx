import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page";
import { PLATFORMS } from "@/lib/platforms";

export const metadata: Metadata = { title: "Inbox baru" };

export default function NewInboxPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link href="/connected-platforms" className="text-sm font-semibold text-brand hover:underline">← Platform terhubung</Link>
      <PageHeader title="Pilih platform" description="Pilih platform tempat pesan pelanggan akan masuk ke inbox baru Anda." />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {PLATFORMS.map((p) => (
          <li key={p.id}>
            {p.href ? (
              <Link href={p.href} className="card flex h-full flex-col gap-2 p-5 transition hover:border-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[17px] font-bold text-navy">{p.name}</span>
                  {p.badge && <span className="badge badge-ok">{p.badge}</span>}
                </span>
                <span className="text-sm leading-relaxed text-muted">{p.text}</span>
                <span className="mt-auto pt-2 text-sm font-semibold text-brand">Hubungkan →</span>
              </Link>
            ) : (
              <div className="flex h-full flex-col gap-2 rounded-card border border-dashed border-line p-5 opacity-75">
                <span className="flex items-center gap-2">
                  <span className="text-[17px] font-bold text-navy">{p.name}</span>
                  <span className="badge badge-muted">Segera</span>
                </span>
                <span className="text-sm text-muted">{p.text}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
