"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/auth";
import { extractVariables } from "@/lib/followups/variables";

export type TemplateState = { ok?: boolean; error?: string };

const schema = z.object({
  name: z.string().trim().min(2, "Nama template minimal 2 karakter.").max(120),
  category: z.string().trim().min(1).max(60),
  body: z.string().trim().min(5, "Isi pesan terlalu pendek.").max(1024, "Isi pesan maksimal 1024 karakter."),
});

export async function createTemplate(_: TemplateState, formData: FormData): Promise<TemplateState> {
  const parsed = schema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") || "umum",
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { supabase, businessId } = await requireContext();
  const { error } = await supabase.from("followup_templates").insert({
    business_id: businessId,
    ...parsed.data,
    variables: extractVariables(parsed.data.body),
    source: "app",
  });
  if (error) return { error: "Gagal menyimpan template." };
  revalidatePath("/templates");
  return { ok: true };
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
