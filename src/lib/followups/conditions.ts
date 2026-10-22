export type Condition = { field: string; op: "eq" | "neq" | "gt" | "lt" | "exists" | "in"; value?: string | number; values?: string[] };

function pick(data: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), data);
}

/** Semua kondisi harus terpenuhi (AND). Data tidak ada → kondisi gagal, kecuali `neq`. `in` pada data array = cukup satu yang cocok. */
export function matchesConditions(conds: Condition[], data: unknown): boolean {
  return conds.every((c) => {
    const v = pick(data, c.field);
    switch (c.op) {
      case "exists": return v !== undefined && v !== null && v !== "";
      case "eq": return v !== undefined && String(v) === String(c.value);
      case "neq": return v === undefined || String(v) !== String(c.value);
      case "gt": return Number(v) > Number(c.value);
      case "lt": return Number(v) < Number(c.value);
      case "in": {
        const allowed = new Set(c.values ?? []);
        return (Array.isArray(v) ? v : [v]).some((x) => x !== undefined && x !== null && allowed.has(String(x)));
      }
    }
  });
}
