"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdmin, requireContext } from "@/lib/auth";
import { configSchema, MAX_INSTRUCTIONS, STYLE_PRESETS, instructionSchema, routingSchema } from "@/lib/ai/config";

export type AgentState = { ok?: boolean; error?: string };

const uuid = z.string().uuid();
const ADMIN_ONLY = "Hanya owner/admin yang bisa mengubah AI agent.";
const text = (max: number) => z.string().trim().max(max, `Maksimal ${max} karakter.`).transform((v) => v || null);

async function adminCtx() {
  const ctx = await requireContext();
  return isAdmin(ctx) ? ctx : null;
}

const done = (id?: string) => {
  revalidatePath("/ai-agents");
  if (id) revalidatePath(`/ai-agents/${id}`);
  revalidatePath("/connected-platforms");
  return { ok: true };
};

export async function createAgent(_: AgentState, formData: FormData): Promise<AgentState> {
  const parsed = z.object({ name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(60) }).safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await adminCtx();
  if (!ctx) return { error: ADMIN_ONLY };
  const { data, error } = await ctx.supabase
    .from("ai_agents")
    .insert({ business_id: ctx.businessId, name: parsed.data.name, config: configSchema.parse({}), routing: routingSchema.parse({ transfer: {}, label: {} }) })
    .select("id")
    .single();
  if (error || !data) return { error: "Gagal membuat AI agent." };
  done();
  redirect(`/ai-agents/${data.id}`);
}

export async function deleteAgent(id: string): Promise<AgentState> {
  if (!uuid.safeParse(id).success) return { error: "Data tidak valid." };
  const ctx = await adminCtx();
  if (!ctx) return { error: ADMIN_ONLY };
  // Inbox yang memakai agen ini otomatis dilepas (FK on delete set null).
  const { error } = await ctx.supabase.from("ai_agents").delete().eq("id", id).eq("business_id", ctx.businessId);
  if (error) return { error: "Gagal menghapus." };
  done();
  redirect("/ai-agents");
}

async function update(id: string, patch: Record<string, unknown>): Promise<AgentState> {
  if (!uuid.safeParse(id).success) return { error: "Data tidak valid." };
  const ctx = await adminCtx();
  if (!ctx) return { error: ADMIN_ONLY };
  const { data, error } = await ctx.supabase
    .from("ai_agents")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", ctx.businessId)
    .select("id");
  if (error || !data?.length) return { error: "Gagal menyimpan." };
  return done(id);
}

const behaviorSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter.").max(60),
  welcome_message: text(1000),
  style_preset: z.enum(STYLE_PRESETS),
  communication: text(4000),
  conversation_flow: text(4000),
  rules: text(4000),
});

export async function saveBehavior(_: AgentState, formData: FormData): Promise<AgentState> {
  const parsed = behaviorSchema.safeParse(Object.fromEntries(["name", "welcome_message", "style_preset", "communication", "conversation_flow", "rules"].map((k) => [k, formData.get(k) ?? ""])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Instruksi tambahan: pasangan kondisi/instruksi berurutan; baris tanpa instruksi diabaikan.
  const conditions = formData.getAll("ai_condition").map(String);
  const instructions = formData.getAll("ai_instruction").map(String);
  const extra = instructions
    .map((instruction, i) => instructionSchema.safeParse({ condition: conditions[i] ?? "", instruction }))
    .flatMap((r) => (r.success ? [r.data] : []));
  if (extra.length > MAX_INSTRUCTIONS) return { error: `Maksimal ${MAX_INSTRUCTIONS} instruksi tambahan.` };

  return update(String(formData.get("id")), { ...parsed.data, additional_instructions: extra });
}

export async function saveRouting(_: AgentState, formData: FormData): Promise<AgentState> {
  const routing = routingSchema.safeParse({
    transfer: { enabled: formData.get("transfer_enabled") === "on", condition: String(formData.get("transfer_condition") ?? "").trim() },
    label: { enabled: formData.get("label_enabled") === "on", condition: String(formData.get("label_condition") ?? "").trim() },
  });
  if (!routing.success) return { error: "Data tidak valid." };
  if (routing.data.transfer.enabled && !routing.data.transfer.condition) return { error: "Tulis kapan AI harus mengalihkan ke agen manusia." };
  return update(String(formData.get("id")), { routing: routing.data });
}

export async function saveConfig(_: AgentState, formData: FormData): Promise<AgentState> {
  const strict = configSchema.extend({
    history_limit: z.coerce.number().int().min(1, "Riwayat minimal 1.").max(100, "Riwayat maksimal 100."),
    context_limit: z.coerce.number().int().min(1, "Konteks minimal 1.").max(50, "Konteks maksimal 50."),
    message_await_seconds: z.coerce.number().int().min(0, "Jeda minimal 0.").max(60, "Jeda maksimal 60 detik."),
    message_limit: z.coerce.number().int().min(1, "Batas pesan minimal 1.").max(10000, "Batas pesan maksimal 10.000."),
  });
  const parsed = strict.safeParse({
    stop_after_transfer: formData.get("stop_after_transfer") === "on",
    silent_transfer: formData.get("silent_transfer") === "on",
    timezone: formData.get("timezone"),
    history_limit: formData.get("history_limit"),
    context_limit: formData.get("context_limit"),
    creativity: formData.get("creativity"),
    message_await_seconds: formData.get("message_await_seconds"),
    message_limit: formData.get("message_limit"),
    session_only_memory: formData.get("session_only_memory") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  return update(String(formData.get("id")), { config: parsed.data });
}

const knowledgeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), title: text(120), content: z.string().trim().min(1, "Isi pengetahuan kosong.").max(20000, "Maksimal 20.000 karakter.") }),
  z.object({ kind: z.literal("qa"), question: z.string().trim().min(3, "Pertanyaan terlalu pendek.").max(500), answer: z.string().trim().min(1, "Jawaban kosong.").max(4000) }),
]);

export async function addKnowledge(_: AgentState, formData: FormData): Promise<AgentState> {
  const agentId = String(formData.get("agent_id"));
  if (!uuid.safeParse(agentId).success) return { error: "Data tidak valid." };
  const parsed = knowledgeSchema.safeParse(Object.fromEntries(["kind", "title", "content", "question", "answer"].map((k) => [k, formData.get(k) ?? ""])));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await adminCtx();
  if (!ctx) return { error: ADMIN_ONLY };
  const { error } = await ctx.supabase.from("ai_knowledge").insert({ business_id: ctx.businessId, agent_id: agentId, ...parsed.data });
  if (error) return { error: error.code === "23503" ? "AI agent tidak ditemukan." : "Gagal menyimpan." };
  return done(agentId);
}

export async function deleteKnowledge(agentId: string, id: string): Promise<AgentState> {
  if (!uuid.safeParse(agentId).success || !uuid.safeParse(id).success) return { error: "Data tidak valid." };
  const ctx = await adminCtx();
  if (!ctx) return { error: ADMIN_ONLY };
  await ctx.supabase.from("ai_knowledge").delete().eq("id", id).eq("agent_id", agentId).eq("business_id", ctx.businessId);
  return done(agentId);
}
