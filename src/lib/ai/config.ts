import { z } from "zod";

// Pengaturan AI agent (cerminan tab Cekat: AI Behavior, AI Actions & Routing, AI Configuration).
// Disimpan sebagai jsonb; parse di batas data dengan default agar baris lama/parsial tetap terbaca.

export const STYLE_PRESETS = ["formal", "friendly", "empathetic", "concise", "educational"] as const;
export type StylePreset = (typeof STYLE_PRESETS)[number];
export const STYLE_LABEL: Record<StylePreset, string> = {
  formal: "Formal",
  friendly: "Ramah",
  empathetic: "Empatik",
  concise: "Ringkas",
  educational: "Edukatif",
};

export const CREATIVITY = ["consistent", "balanced", "creative"] as const;
export const CREATIVITY_LABEL: Record<(typeof CREATIVITY)[number], string> = {
  consistent: "Konsisten",
  balanced: "Seimbang",
  creative: "Kreatif",
};

const int = (min: number, max: number, def: number) => z.coerce.number().int().min(min).max(max).catch(def);

export const configSchema = z.object({
  stop_after_transfer: z.boolean().catch(true),
  silent_transfer: z.boolean().catch(false),
  timezone: z.string().max(60).catch("Asia/Jakarta"),
  history_limit: int(1, 100, 20),
  context_limit: int(1, 50, 10),
  creativity: z.enum(CREATIVITY).catch("consistent"),
  message_await_seconds: int(0, 60, 5),
  message_limit: int(1, 10000, 1000),
  session_only_memory: z.boolean().catch(false),
});
export type AgentConfig = z.infer<typeof configSchema>;

const rule = z.object({ enabled: z.boolean().catch(false), condition: z.string().max(1000).catch("") }).catch({ enabled: false, condition: "" });
export const routingSchema = z.object({ transfer: rule, label: rule });
export type AgentRouting = z.infer<typeof routingSchema>;

export const instructionSchema = z.object({
  condition: z.string().trim().max(500),
  instruction: z.string().trim().min(1).max(2000),
});
export type AdditionalInstruction = z.infer<typeof instructionSchema>;

const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export const parseConfig = (raw: unknown): AgentConfig => configSchema.parse(obj(raw));
export const parseRouting = (raw: unknown): AgentRouting => routingSchema.parse(obj(raw));
export function parseInstructions(raw: unknown): AdditionalInstruction[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => {
    const p = instructionSchema.safeParse(r);
    return p.success ? [p.data] : [];
  });
}

export const MAX_INSTRUCTIONS = 10;
