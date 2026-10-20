"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/auth";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function toggleRule(ruleId: string, active: boolean): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(ruleId).success) return { ok: false, error: "Aturan tidak valid." };
  const { supabase, businessId } = await requireContext();
  const { error, count } = await supabase
    .from("followup_rules")
    .update({ active, updated_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", ruleId)
    .eq("business_id", businessId);
  if (error) return { ok: false, error: "Gagal menyimpan." };
  if (!count) return { ok: false, error: "Aturan tidak ditemukan." };
  revalidatePath("/followups");
  return { ok: true };
}

export async function deleteRule(ruleId: string) {
  if (!z.string().uuid().safeParse(ruleId).success) return;
  const { supabase, businessId } = await requireContext();
  await supabase.from("followup_rules").delete().eq("id", ruleId).eq("business_id", businessId);
  revalidatePath("/followups");
}

const ruleSchema = z.object({
  name: z.string().trim().min(2, "Nama aturan minimal 2 karakter.").max(120),
  trigger_event: z.string().regex(/^[a-z0-9_.:-]{1,64}$/, "Event pemicu tidak valid."),
  condition: z
    .object({
      field: z.string().trim().min(1).max(60),
      op: z.enum(["eq", "neq", "gt", "lt", "exists"]),
      value: z.string().max(120).optional(),
    })
    .nullable(),
  steps: z
    .array(
      z.object({
        template_id: z.string().uuid("Pilih template untuk setiap pesan."),
        delay_minutes: z.number().int().min(0).max(60 * 24 * 30),
      }),
    )
    .min(1, "Tambahkan minimal satu pesan.")
    .max(5, "Maksimal 5 pesan per aturan."),
  stop_events: z.array(z.string().regex(/^[a-z0-9_.:-]{1,64}$/)).max(10),
  window: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("anytime") }),
    z.object({ mode: z.literal("custom"), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) }),
  ]),
  max_per_day: z.number().int().min(1).max(20).nullable(),
  activate: z.boolean(),
});

export type RulePayload = z.input<typeof ruleSchema>;

export async function createRule(payload: RulePayload): Promise<ActionResult> {
  const parsed = ruleSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const v = parsed.data;

  const { supabase, businessId } = await requireContext();

  // Template harus milik bisnis ini dan aktif (RLS + filter eksplisit).
  const ids = [...new Set(v.steps.map((s) => s.template_id))];
  const { count } = await supabase
    .from("followup_templates")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "active")
    .in("id", ids);
  if (count !== ids.length) return { ok: false, error: "Ada template yang tidak ditemukan atau sudah diarsipkan." };

  const { error } = await supabase.from("followup_rules").insert({
    business_id: businessId,
    name: v.name,
    trigger_event: v.trigger_event,
    conditions: v.condition ? [{ ...v.condition, value: v.condition.value ?? "" }] : [],
    steps: v.steps,
    stop_events: v.stop_events.filter((e) => e !== v.trigger_event),
    send_window: v.window,
    max_per_day: v.max_per_day,
    active: v.activate,
    source: "app",
  });
  if (error) return { ok: false, error: "Gagal menyimpan aturan." };

  revalidatePath("/followups");
  redirect("/followups");
}
