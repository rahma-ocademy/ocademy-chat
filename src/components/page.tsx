export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-[28px] leading-tight font-bold text-navy">{title}</h1>
        {description ? <p className="mt-1.5 text-[15px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="text-lg font-bold text-navy">{title}</p>
      <p className="max-w-md text-sm leading-relaxed text-muted">{text}</p>
      {action}
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

export const sourceBadge = (s: string) =>
  s === "orderonline" ? { cls: "badge badge-info", label: "OrderOnline" } : s === "api" ? { cls: "badge badge-info", label: "API" } : { cls: "badge badge-muted", label: "Di aplikasi" };

export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4" aria-hidden="true">
      <div className="h-9 w-64 rounded-lg bg-tint" />
      <div className="h-4 w-96 max-w-full rounded bg-tint" />
      <div className="card h-72" />
    </div>
  );
}
