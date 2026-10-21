"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireContext } from "@/lib/auth";

export type InboxState = { ok?: boolean; error?: string };

export async function createInbox(_: InboxState, formData: FormData): Promise<InboxState> {
  const parsed = z.object({ name: z.string().trim().min(2, "Nama inbox minimal 2 karakter.").max(60) }).safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { supabase, businessId } = await requireContext();
  const { error } = await supabase.from("inboxes").insert({ business_id: businessId, type: "livechat", name: parsed.data.name });
  if (error) return { error: "Gagal membuat inbox." };
  revalidatePath("/inboxes");
  revalidatePath("/chat");
  return { ok: true };
}

export async function setInboxActive(id: string, active: boolean) {
  if (!z.string().uuid().safeParse(id).success) return;
  const { supabase, businessId } = await requireContext();
  await supabase.from("inboxes").update({ active }).eq("id", id).eq("business_id", businessId);
  revalidatePath("/inboxes");
}
