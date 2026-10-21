"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/auth";
import { extractVariables } from "@/lib/followups/variables";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { syncTemplateStatuses } from "@/lib/whatsapp/template-status";

export type TemplateState = { ok?: boolean; error?: string; message?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Nama template minimal 2 karakter.").max(120),
  category: z.string().trim().min(1).max(60),
  body: z.string().trim().min(5, "Isi pesan terlalu pendek.").max(1024, "Isi pesan maksimal 1024 karakter."),
  // Nama template di WhatsApp Manager: huruf kecil, angka, garis bawah (aturan Meta).
  wa_template_name: z
    .string()
    .trim()
    .max(512)
    .regex(/^[a-z0-9_]*$/, "Nama template WhatsApp hanya boleh huruf kecil, angka, dan garis bawah (mis. pengingat_bayar).")
    .transform((v) => v || null),
});

export async function createTemplate(_: TemplateState, formData: FormData): Promise<TemplateState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") || "umum",
    body: formData.get("body"),
    wa_template_name: formData.get("wa_template_name") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, businessId } = await requireContext();
  const variables = extractVariables(parsed.data.body);
  const { error } = await supabase.from("followup_templates").insert({
    business_id: businessId,
    ...parsed.data,
    variables,
    // Template WhatsApp memakai parameter posisi {{1}}, {{2}}, …: urutannya mengikuti urutan variabel di isi pesan.
    wa_param_map: parsed.data.wa_template_name ? Object.fromEntries(variables.map((v, i) => [String(i + 1), v])) : {},
    source: "app",
  });
  if (error) return { error: "Gagal menyimpan template." };
  // Langsung ambil status Meta bila template ditautkan ke template WhatsApp (abaikan bila WABA belum terhubung).
  if (parsed.data.wa_template_name) await syncTemplateStatuses(createSupabaseAdmin(), businessId).catch(() => null);
  revalidatePath("/templates");
  return { ok: true };
}

/** Ambil status persetujuan terbaru dari Meta untuk semua template yang memakai template WhatsApp. */
export async function refreshTemplateStatuses(): Promise<TemplateState> {
  const { businessId } = await requireContext();
  const r = await syncTemplateStatuses(createSupabaseAdmin(), businessId);
  revalidatePath("/templates");
  if (!r.ok) return { error: r.error };
  if (r.checked === 0) return { message: "Belum ada template yang ditautkan ke template WhatsApp." };
  return { message: `${r.checked} template dicek, ${r.approved} disetujui Meta.` };
}

export async function archiveTemplate(id: string) {
  if (!z.string().uuid().safeParse(id).success) return;
  const { supabase, businessId } = await requireContext();
  await supabase
    .from("followup_templates")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", businessId);
  revalidatePath("/templates");
}
