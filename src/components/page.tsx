import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Inbox, type LucideIcon } from "lucide-react";
import { findNav, type Tone } from "@/components/nav";

/**
 * Judul halaman. `nav` = href menu (mis. "/followups") → ikon, warna, dan nama grup diambil dari nav.ts
 * sehingga setiap halaman konsisten dengan sidebar. `back` untuk halaman turunan.
 */
export function PageHeader({
  title,
  description,
  actions,
  nav,
  back,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  nav?: string;
  back?: { href: string; label: string };
}) {
  const hit = nav ? findNav(nav) : null;
  const Icon = hit?.item.icon;
  return (
    <div className="rise flex flex-col gap-3">
      {back && (
        <Link href={back.href} className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-semibold text-[#01606A] hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-accent">
          <ArrowLeft aria-hidden="true" className="size-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex max-w-3xl items-start gap-4">
          {Icon && (
            <span className={`icon-tile icon-tile-lg tone-${hit?.item.tone} hidden shadow-sm sm:inline-flex`}>
              <Icon aria-hidden="true" className="size-6" strokeWidth={2.1} />
            </span>
          )}
          <div className="min-w-0">
            {hit?.group && <p className="text-xs font-bold tracking-[0.08em] text-brand uppercase">{hit.group}</p>}
            <h1 className="text-[28px] leading-tight font-bold text-navy">{title}</h1>
            {description ? <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
      </div>
    </div>
  );
}

/** Keadaan kosong dengan ilustrasi ikon bergaya brand dan satu aksi utama. */
export function EmptyState({
  title,
  text,
  action,
  icon: Icon = Inbox,
  tone = "brand",
}: {
  title: string;
  text: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span aria-hidden="true" className="relative mb-2 flex size-24 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle,rgb(2_177_195/0.16),transparent_70%)]" />
        <span className="absolute inset-3 rounded-full border-2 border-dashed border-[#CDEBEF]" />
        <span className={`icon-tile icon-tile-lg tone-${tone} relative shadow-sm`}>
          <Icon className="size-6" strokeWidth={2.1} />
        </span>
      </span>
      <p className="text-lg font-bold text-navy">{title}</p>
      <p className="max-w-md text-sm leading-relaxed text-muted">{text}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function Notice({ tone, children }: { tone: "ok" | "warn" | "bad" | "info"; children: React.ReactNode }) {
  const cls = {
    ok: "border-[#BFE5D8] bg-ok-soft text-ok",
    warn: "border-[#F0D29A] bg-[#FFF7E8] text-[#5C3800]",
    bad: "border-[#F3C0BB] bg-bad-soft text-[#912018]",
    info: "border-[#9FDCE4] bg-brand-soft text-[#01606A]",
  }[tone];
  return (
    <div role={tone === "bad" || tone === "warn" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${cls}`}>
      {children}
    </div>
  );
}

/** Kartu angka: ikon berwarna, nilai besar, label, dan catatan opsional. */
export function StatCard({
  icon: Icon,
  tone,
  label,
  value,
  hint,
  alert,
}: {
  icon: LucideIcon;
  tone: Tone;
  label: string;
  value: React.ReactNode;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className={`icon-tile icon-tile-lg tone-${alert ? "rose" : tone}`}>
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        <p className={`text-[28px] leading-tight font-bold ${alert ? "text-bad" : "text-navy"}`}>{value}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}

/** Kartu bagian dengan judul (+ ikon) dan aksi di header. */
export function SectionCard({
  title,
  description,
  icon: Icon,
  tone = "navy",
  actions,
  children,
  id,
  className = "",
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  tone?: Tone;
  actions?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
  className?: string;
}) {
  const hid = id ? `${id}-title` : undefined;
  return (
    <section className={`card overflow-hidden ${className}`} aria-labelledby={hid}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-6 py-4">
        <div className="flex items-center gap-3">
          {Icon && (
            <span className={`icon-tile icon-tile-sm tone-${tone}`}>
              <Icon aria-hidden="true" className="size-4" />
            </span>
          )}
          <div>
            <h2 id={hid} className="text-[17px] font-bold text-navy">{title}</h2>
            {description && <p className="text-[13px] text-muted">{description}</p>}
          </div>
        </div>
        {actions}
      </header>
      <div className="p-6">{children}</div>
    </section>
  );
}

/** Daftar langkah bernomor dengan status selesai dan tombol aksi (onboarding, setup). */
export function StepList({
  steps,
}: {
  steps: { title: string; text: string; done: boolean; href: string; cta: string; icon: LucideIcon; tone: Tone }[];
}) {
  const nextIndex = steps.findIndex((s) => !s.done);
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s, i) => {
        const Icon = s.icon;
        const isNext = i === nextIndex;
        return (
          <li
            key={s.title}
            className={`card flex items-center gap-4 p-4 transition ${isNext ? "border-[#9FDCE4] ring-4 ring-accent/10" : ""} ${s.done ? "bg-[#FBFDFC]" : ""}`}
          >
            <span className={`icon-tile icon-tile-lg ${s.done ? "tone-ok" : `tone-${s.tone}`}`}>
              {s.done ? <Check aria-hidden="true" className="size-6" strokeWidth={2.6} /> : <Icon aria-hidden="true" className="size-6" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-[0.06em] text-muted uppercase">Langkah {i + 1}</p>
              <p className={`font-bold ${s.done ? "text-muted line-through decoration-1" : "text-navy"}`}>
                {s.title} {s.done && <span className="sr-only">(selesai)</span>}
              </p>
              <p className="mt-0.5 text-sm text-muted">{s.text}</p>
            </div>
            {!s.done && (
              <Link href={s.href} className={`btn btn-sm shrink-0 ${isNext ? "btn-primary" : "btn-secondary"}`}>
                {s.cta}
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export const sourceBadge = (s: string) =>
  s === "orderonline" ? { cls: "badge badge-info", label: "OrderOnline" } : s === "api" ? { cls: "badge badge-info", label: "API" } : { cls: "badge badge-muted", label: "Di aplikasi" };

export function PageSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="flex items-center gap-4">
        <div className="skeleton size-12 rounded-2xl" />
        <div className="space-y-2">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton h-7 w-64" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="skeleton h-24 rounded-card" />
        <div className="skeleton h-24 rounded-card" />
        <div className="skeleton h-24 rounded-card" />
      </div>
      <div className="skeleton h-72 rounded-card" />
    </div>
  );
}
