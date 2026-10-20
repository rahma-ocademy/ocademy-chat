/** Normalisasi nomor ke format internasional tanpa "+" (mis. 0812-3456-789 → 628123456789). Default negara: Indonesia. */
export function normalizePhone(input: string | undefined, defaultCountry = "62"): string | undefined {
  if (!input) return undefined;
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = defaultCountry + d.slice(1);
  else if (d.startsWith("8")) d = defaultCountry + d;
  return /^\d{8,15}$/.test(d) ? d : undefined;
}
