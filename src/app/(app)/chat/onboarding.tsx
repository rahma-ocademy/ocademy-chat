import Link from "next/link";

type Setup = { hasInbox: boolean; hasConversation: boolean; hasActiveRule: boolean };

export function Onboarding({ setup, widgetKey }: { setup: Setup; widgetKey: string | null }) {
  const steps = [
    {
      title: "Hubungkan channel",
      text: "Buat inbox livechat untuk mulai menerima pesan. WhatsApp menyusul.",
      done: setup.hasInbox,
      href: "/inboxes",
      cta: "Buka Channel",
    },
    {
      title: "Kirim pesan uji",
      text: "Buka widget livechat sebagai pelanggan dan kirim satu pesan.",
      done: setup.hasConversation,
      href: widgetKey ? `/w/${widgetKey}` : "/inboxes",
      cta: widgetKey ? "Buka widget uji" : "Buat inbox dulu",
      external: Boolean(widgetKey),
    },
    {
      title: "Aktifkan follow-up",
      text: "Buat template dan aturan follow-up otomatis.",
      done: setup.hasActiveRule,
      href: "/followups/new",
      cta: "Buat follow-up",
    },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-navy">Selamat datang di ocademy chat!</h2>
        <p className="mt-1 text-sm text-muted">Tiga langkah untuk mulai menerima dan membalas pesan.</p>
      </div>
      <ol className="flex w-full max-w-lg flex-col gap-3">
        {steps.map((s, i) => (
          <li key={s.title} className="card flex items-start gap-4 p-4">
            <span
              aria-hidden="true"
              className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${s.done ? "bg-ok-soft text-ok" : "bg-tint text-navy"}`}
            >
              {s.done ? "✓" : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-navy">
                {s.title} {s.done && <span className="sr-only">(selesai)</span>}
              </p>
              <p className="mt-0.5 text-sm text-muted">{s.text}</p>
            </div>
            {!s.done && (
              <Link href={s.href} className="btn btn-secondary btn-sm shrink-0" {...(s.external ? { target: "_blank", rel: "noopener" } : {})}>
                {s.cta}
              </Link>
            )}
          </li>
        ))}
        <li className="flex items-start gap-4 rounded-xl border border-dashed border-line p-4 opacity-70">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-tint text-sm font-bold text-muted">4</span>
          <div>
            <p className="font-bold text-navy">AI agent</p>
            <p className="mt-0.5 text-sm text-muted">Menjawab pesan otomatis dari knowledge bisnis Anda. Segera hadir.</p>
          </div>
        </li>
      </ol>
    </div>
  );
}
