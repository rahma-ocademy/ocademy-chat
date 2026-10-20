export type Step = { template_id: string; delay_minutes: number; at_hour?: number };
export type SendWindow = { mode: "anytime" } | { mode: "custom"; start: string; end: string; tz?: string };

export const DEFAULT_TZ = "Asia/Jakarta";

function parts(date: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const o: Record<string, number> = {};
  for (const p of f.formatToParts(date)) if (p.type !== "literal") o[p.type] = Number(p.value);
  return { y: o.year, mo: o.month, d: o.day, h: o.hour === 24 ? 0 : o.hour, mi: o.minute };
}

/** Selisih (menit) zona waktu terhadap UTC pada saat `date`. */
function offsetMinutes(date: Date, tz: string) {
  const p = parts(date, tz);
  return (Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) - Math.floor(date.getTime() / 60000) * 60000) / 60000;
}

/** Waktu dinding (lokal di `tz`) pada hari lokal `base` + `addDays`, jam `h:m`. */
function localInstant(base: Date, tz: string, addDays: number, h: number, m: number): Date {
  const p = parts(base, tz);
  const guess = Date.UTC(p.y, p.mo - 1, p.d + addDays, h, m);
  const first = new Date(guess - offsetMinutes(new Date(guess), tz) * 60000);
  // Koreksi sekali untuk zona ber-DST yang offset-nya berbeda di titik tujuan.
  return new Date(guess - offsetMinutes(first, tz) * 60000);
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

export function computeScheduledAt(base: Date, step: Step, window: SendWindow, tz = DEFAULT_TZ): Date {
  const earliest = new Date(base.getTime() + step.delay_minutes * 60000);
  let t = earliest;

  // "H+N pukul HH.00" = hari kalender ke-N setelah event, bukan N×24 jam.
  if (step.at_hour !== undefined) {
    const days = Math.round(step.delay_minutes / 1440);
    t = localInstant(base, tz, days, step.at_hour, 0);
    if (t.getTime() < base.getTime()) t = base;
  }

  if (window.mode === "custom") {
    const wtz = window.tz ?? tz;
    const s = toMin(window.start);
    const e = toMin(window.end);
    const p = parts(t, wtz);
    const m = p.h * 60 + p.mi;
    const inside = s < e ? m >= s && m < e : m >= s || m < e;
    if (!inside) {
      const sameDayStart = m < s;
      t = localInstant(t, wtz, sameDayStart ? 0 : 1, Math.floor(s / 60), s % 60);
    }
  }
  return t;
}
