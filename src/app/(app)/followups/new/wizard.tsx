"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Zap } from "lucide-react";
import { useState, useTransition } from "react";
import { EVENTS, eventLabel } from "@/lib/followups/events";
import { createRule } from "../actions";

export type TemplateOption = { id: string; name: string; category: string; source: string };
type StepForm = { template_id: string; amount: number; unit: "menit" | "jam" | "hari" };

const UNIT_MIN = { menit: 1, jam: 60, hari: 1440 } as const;
const STEPS = ["Pemicu", "Template & jeda", "Jadwal & aturan", "Ringkasan"] as const;
const FIELDS = [
  { value: "payment_status", label: "Status pembayaran" },
  { value: "payment_method", label: "Metode pembayaran" },
  { value: "total", label: "Total order" },
];

export function Wizard({ templates }: { templates: TemplateOption[] }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState(EVENTS[0].type);
  const [useCond, setUseCond] = useState(false);
  const [cond, setCond] = useState<{ field: string; op: "eq" | "neq" | "gt" | "lt"; value: string }>({ field: "payment_status", op: "neq", value: "paid" });
  const [steps, setSteps] = useState<StepForm[]>([{ template_id: templates[0].id, amount: 2, unit: "jam" }]);
  const [windowMode, setWindowMode] = useState<"anytime" | "custom">("anytime");
  const [win, setWin] = useState({ start: "08:00", end: "21:00" });
  const [stops, setStops] = useState<string[]>(["order.paid", "order.cancelled"]);
  const [maxPerDay, setMaxPerDay] = useState<number | "">(2);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const tplName = (id: string) => templates.find((t) => t.id === id)?.name ?? "—";

  function validate(s: number): string | null {
    if (s === 0 && name.trim().length < 2) return "Beri nama aturan (minimal 2 karakter).";
    if (s === 1 && steps.some((x) => !x.template_id || x.amount < 0 || !Number.isFinite(x.amount))) return "Lengkapi template dan jeda setiap pesan.";
    return null;
  }

  function next() {
    const e = validate(step);
    setError(e);
    if (!e) setStep((s) => s + 1);
  }

  function submit(activate: boolean) {
    setError(null);
    startTransition(async () => {
      const r = await createRule({
        name,
        trigger_event: trigger,
        condition: useCond ? cond : null,
        steps: steps.map((s) => ({ template_id: s.template_id, delay_minutes: Math.round(s.amount * UNIT_MIN[s.unit]) })),
        stop_events: stops,
        window: windowMode === "anytime" ? { mode: "anytime" } : { mode: "custom", ...win },
        max_per_day: maxPerDay === "" ? null : maxPerDay,
        activate,
      });
      if (r && !r.ok) setError(r.error); // sukses = redirect dari server action
    });
  }

  const toggleStop = (t: string) => setStops((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  const updateStep = (i: number, patch: Partial<StepForm>) => setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link href="/followups" className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#01606A] hover:underline">
          <ArrowLeft aria-hidden="true" className="size-4" /> Follow-up otomatis
        </Link>
        <div className="flex items-start gap-4">
          <span className="icon-tile icon-tile-lg tone-amber hidden sm:inline-flex"><Zap aria-hidden="true" className="size-6" /></span>
          <div>
            <p className="text-xs font-bold tracking-[0.08em] text-brand uppercase">Buat follow-up · Langkah {step + 1} dari {STEPS.length}</p>
            <h1 className="mt-0.5 text-[28px] leading-tight font-bold text-navy">
              {["Kapan follow-up dikirim?", "Pesan apa dan kapan?", "Jadwal & aturan berhenti", "Periksa & aktifkan"][step]}
            </h1>
          </div>
        </div>
      </div>

      <div className="progress" aria-hidden="true">
        <span className="bg-brand-gradient" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <ol aria-label="Langkah" className="-mt-2 flex flex-wrap gap-2">
        {STEPS.map((label, i) => {
          const now = i === step;
          const done = i < step;
          return (
            <li
              key={label}
              aria-current={now ? "step" : undefined}
              className={`flex min-w-36 flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5 ${
                now ? "border-2 border-brand bg-brand-soft shadow-[0_6px_16px_rgb(1_127_140/0.14)]" : done ? "border border-[#BFE5D8] bg-white" : "border border-line-soft bg-white"
              }`}
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${now ? "bg-brand text-white" : done ? "bg-ok-soft text-ok" : "bg-tint text-muted"}`}>
                {done ? <Check aria-hidden="true" className="size-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={`text-sm ${now ? "font-bold text-navy" : "text-muted"}`}>{label}</span>
            </li>
          );
        })}
      </ol>

      <div className="card flex flex-col gap-6 p-6">
        {step === 0 && (
          <>
            <div>
              <label htmlFor="name" className="label">Nama aturan</label>
              <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Pengingat pembayaran" />
            </div>
            <fieldset>
              <legend className="label">Event pemicu</legend>
              <div className="flex flex-col gap-2">
                {EVENTS.map((e) => (
                  <label key={e.type} className={`flex min-h-11 cursor-pointer flex-wrap items-center gap-3 rounded-lg px-3.5 py-2.5 transition ${trigger === e.type ? "border-2 border-brand bg-brand-soft" : "border border-line-soft hover:border-line"}`}>
                    <input type="radio" name="trigger" className="size-[18px] accent-brand" checked={trigger === e.type} onChange={() => setTrigger(e.type)} />
                    <code className="w-44 font-mono text-[13px] text-navy">{e.type}</code>
                    <span className="flex-1 text-sm">{e.label}</span>
                    <span className="text-[13px] text-muted">{e.variables.join(", ")}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2.5 text-sm font-medium text-navy">
                <input type="checkbox" className="size-[18px] accent-brand" checked={useCond} onChange={(e) => setUseCond(e.target.checked)} />
                Tambahkan kondisi (opsional)
              </label>
              {useCond && (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-48 flex-1">
                    <label htmlFor="c-field" className="label">Data</label>
                    <select id="c-field" className="field" value={cond.field} onChange={(e) => setCond({ ...cond, field: e.target.value })}>
                      {FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div className="w-44">
                    <label htmlFor="c-op" className="label">Aturan</label>
                    <select id="c-op" className="field" value={cond.op} onChange={(e) => setCond({ ...cond, op: e.target.value as typeof cond.op })}>
                      <option value="eq">sama dengan</option><option value="neq">bukan</option><option value="gt">lebih dari</option><option value="lt">kurang dari</option>
                    </select>
                  </div>
                  <div className="min-w-48 flex-1">
                    <label htmlFor="c-val" className="label">Nilai</label>
                    <input id="c-val" className="field" value={cond.value} onChange={(e) => setCond({ ...cond, value: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm leading-relaxed text-muted">
              Urutan pesan dikirim setelah event <code className="font-mono text-navy">{trigger}</code>. Jeda dihitung dari saat event diterima.
            </p>
            <ol className="flex flex-col gap-3">
              {steps.map((s, i) => (
                <li key={i} className="flex flex-wrap items-end gap-3 rounded-xl bg-bg p-4">
                  <span className="mb-2.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">{i + 1}</span>
                  <div className="min-w-60 flex-[2]">
                    <label htmlFor={`t-${i}`} className="label">Template</label>
                    <select id={`t-${i}`} className="field" value={s.template_id} onChange={(e) => updateStep(i, { template_id: e.target.value })}>
                      {templates.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.category}</option>)}
                    </select>
                  </div>
                  <div className="w-24">
                    <label htmlFor={`a-${i}`} className="label">Jeda</label>
                    <input id={`a-${i}`} type="number" min={0} className="field" value={s.amount} onChange={(e) => updateStep(i, { amount: Number(e.target.value) })} />
                  </div>
                  <div className="w-28">
                    <label htmlFor={`u-${i}`} className="label">Satuan</label>
                    <select id={`u-${i}`} className="field" value={s.unit} onChange={(e) => updateStep(i, { unit: e.target.value as StepForm["unit"] })}>
                      <option value="menit">menit</option><option value="jam">jam</option><option value="hari">hari</option>
                    </select>
                  </div>
                  {steps.length > 1 && (
                    <button type="button" className="btn btn-danger btn-sm mb-0.5" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} aria-label={`Hapus pesan ${i + 1}`}>Hapus</button>
                  )}
                </li>
              ))}
            </ol>
            {steps.length < 5 && (
              <button type="button" className="btn btn-dashed self-start" onClick={() => setSteps((x) => [...x, { template_id: templates[0].id, amount: 1, unit: "hari" }])}>
                + Tambah pesan berikutnya
              </button>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="label">Waktu kirim</legend>
              <label className="flex items-center gap-2.5 text-sm"><input type="radio" name="win" className="size-[18px] accent-brand" checked={windowMode === "anytime"} onChange={() => setWindowMode("anytime")} />Kapan saja</label>
              <label className="flex items-center gap-2.5 text-sm"><input type="radio" name="win" className="size-[18px] accent-brand" checked={windowMode === "custom"} onChange={() => setWindowMode("custom")} />Hanya pada jam tertentu (WIB)</label>
              {windowMode === "custom" && (
                <div className="flex flex-wrap items-end gap-3 pl-7">
                  <div><label htmlFor="w-s" className="label">Mulai</label><input id="w-s" type="time" className="field" value={win.start} onChange={(e) => setWin({ ...win, start: e.target.value })} /></div>
                  <div><label htmlFor="w-e" className="label">Selesai</label><input id="w-e" type="time" className="field" value={win.end} onChange={(e) => setWin({ ...win, end: e.target.value })} /></div>
                  <p className="hint basis-full">Pesan di luar jam ini ditunda ke awal jam berikutnya.</p>
                </div>
              )}
            </fieldset>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="label">Berhenti jika event ini diterima untuk order yang sama</legend>
              {EVENTS.filter((e) => e.type !== trigger).map((e) => (
                <label key={e.type} className="flex items-center gap-2.5 text-sm">
                  <input type="checkbox" className="size-[18px] accent-brand" checked={stops.includes(e.type)} onChange={() => toggleStop(e.type)} />
                  <code className="font-mono text-[13px] text-navy">{e.type}</code><span className="text-muted">{e.label}</span>
                </label>
              ))}
            </fieldset>
            <div className="max-w-xs">
              <label htmlFor="max" className="label">Maksimal follow-up per pelanggan per hari</label>
              <input id="max" type="number" min={1} max={20} className="field" value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value === "" ? "" : Number(e.target.value))} />
              <p className="hint">Kosongkan untuk tanpa batas.</p>
            </div>
          </>
        )}

        {step === 3 && (
          <dl className="flex flex-col">
            {[
              ["Nama", name],
              ["Pemicu", `${trigger} — ${eventLabel(trigger)}`],
              ["Kondisi", useCond ? `${FIELDS.find((f) => f.value === cond.field)?.label} ${({ eq: "=", neq: "≠", gt: ">", lt: "<" })[cond.op]} ${cond.value}` : "Tidak ada"],
              ["Pesan", steps.map((s, i) => `${i + 1}. ${tplName(s.template_id)} · ${s.amount === 0 ? "langsung" : `${s.amount} ${s.unit}`}`).join("\n")],
              ["Waktu kirim", windowMode === "anytime" ? "Kapan saja" : `${win.start}–${win.end} WIB`],
              ["Berhenti jika", stops.filter((s) => s !== trigger).join(", ") || "—"],
              ["Batas harian", maxPerDay === "" ? "Tanpa batas" : `${maxPerDay} pesan/pelanggan`],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-wrap gap-3 border-t border-line-soft py-3 first:border-t-0 first:pt-0">
                <dt className="w-36 shrink-0 text-sm text-muted">{k}</dt>
                <dd className="min-w-0 flex-1 text-[15px] whitespace-pre-line">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {error && <p role="alert" className="rounded-lg bg-bad-soft px-3.5 py-2.5 text-sm text-[#912018]">{error}</p>}
      </div>

      <div className="card sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 p-3.5 shadow-[var(--shadow-pop)]">
        {step === 0 ? (
          <Link href="/followups" className="btn btn-secondary btn-lg">Batal</Link>
        ) : (
          <button type="button" className="btn btn-secondary btn-lg" onClick={() => { setError(null); setStep(step - 1); }}><ArrowLeft aria-hidden="true" className="size-4" /> Kembali</button>
        )}
        {step < STEPS.length - 1 ? (
          <button type="button" className="btn btn-primary btn-lg" onClick={next}>Lanjut <ArrowRight aria-hidden="true" className="size-4" /></button>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            <button type="button" className="btn btn-secondary btn-lg" disabled={pending} onClick={() => submit(false)}>Simpan sebagai draf</button>
            <button type="button" className="btn btn-primary btn-lg" disabled={pending} onClick={() => submit(true)}>{pending ? "Menyimpan…" : <><Check aria-hidden="true" className="size-4" strokeWidth={3} /> Aktifkan follow-up</>}</button>
          </div>
        )}
      </div>
    </div>
  );
}
