"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isAdmin, requireContext } from "@/lib/auth";
import { optionalEnv } from "@/lib/env";
import { extractVariables } from "@/lib/followups/variables";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { loadToken } from "@/lib/whatsapp/channel";
import { createMessageTemplate, GraphError } from "@/lib/whatsapp/graph";
import { META_CATEGORIES, metaBodyProblem, slugTemplateName, toMetaBody } from "@/lib/whatsapp/template-format";
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

const WA_NAME_RE = /^[a-z0-9_]+$/;

/** WABA + token dari inbox WhatsApp yang terhubung (dipakai untuk mengajukan template ke Meta). */
async function findWaba(businessId: string): Promise<{ wabaId: string; token: string } | null> {
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("inboxes")
    .select("id, wa_waba_id")
    .eq("business_id", businessId)
    .eq("type", "whatsapp")
    .neq("status", "disconnected")
    .not("wa_waba_id", "is", null)
    .order("created_at");
  for (const inbox of data ?? []) {
    const token = await loadToken(admin, inbox.id as string).catch(() => null);
    if (token) return { wabaId: inbox.wa_waba_id as string, token };
  }
  return null;
}

type Submitted = { ok: true; waName: string; status: string } | { ok: false; error: string };

/** Ajukan isi template ke Meta. Dipakai saat membuat template baru dan untuk template yang sudah ada. */
async function submitToMeta(businessId: string, input: { name: string; body: string; waName: string | null; category: unknown }): Promise<Submitted> {
  const waName = input.waName ?? slugTemplateName(input.name);
  if (!WA_NAME_RE.test(waName)) return { ok: false, error: "Nama template WhatsApp tidak valid. Isi manual dengan huruf kecil, angka, dan garis bawah." };
  const problem = metaBodyProblem(input.body);
  if (problem) return { ok: false, error: problem };
  const category = META_CATEGORIES.find((c) => c === input.category) ?? "UTILITY";
  const waba = await findWaba(businessId);
  if (!waba) return { ok: false, error: "Belum ada WhatsApp yang terhubung. Hubungkan WABA di Platform terhubung untuk mengajukan template ke Meta." };
  const meta = toMetaBody(input.body);
  try {
    const r = await createMessageTemplate(waba.token, waba.wabaId, {
      name: waName,
      language: optionalEnv("WHATSAPP_TEMPLATE_LANGUAGE") ?? "id",
      category,
      body: meta.text,
      bodyExamples: meta.examples,
    });
    return { ok: true, waName, status: r.status };
  } catch (e) {
    return { ok: false, error: `Meta menolak pengajuan: ${e instanceof GraphError ? e.message : "gagal menghubungi Meta."}` };
  }
}

/** Ajukan template yang sudah ada (mis. hasil impor OrderOnline) ke Meta. */
export async function submitTemplateToMeta(id: string, category: string): Promise<TemplateState> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Data tidak valid." };
  const ctx = await requireContext();
  if (!isAdmin(ctx)) return { error: "Hanya owner/admin yang bisa mengajukan template ke Meta." };
  const { supabase, businessId } = ctx;
  const { data: t } = await supabase
    .from("followup_templates")
    .select("id, name, body, wa_template_name")
    .eq("id", id)
    .eq("business_id", businessId)
    .neq("status", "archived")
    .maybeSingle();
  if (!t) return { error: "Template tidak ditemukan." };
  if (t.wa_template_name) return { error: "Template ini sudah ditautkan ke template WhatsApp." };
  if (!String(t.body ?? "").trim()) return { error: "Isi template belum tersedia (preset OrderOnline). Buat template baru dengan isi sendiri." };

  const r = await submitToMeta(businessId, { name: t.name as string, body: t.body as string, waName: null, category });
  if (!r.ok) return { error: r.error };
  const variables = extractVariables(t.body as string);
  const { error } = await supabase
    .from("followup_templates")
    .update({
      wa_template_name: r.waName,
      wa_param_map: Object.fromEntries(variables.map((v, i) => [String(i + 1), v])),
      wa_status: r.status,
      wa_status_checked_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) return { error: `Sudah diajukan ke Meta sebagai "${r.waName}", tapi gagal disimpan di sini. Tautkan manual dengan nama itu.` };
  revalidatePath("/templates");
  return { ok: true, message: `Template diajukan ke Meta sebagai "${r.waName}". Status tampil di tabel.` };
}

export async function createTemplate(_: TemplateState, formData: FormData): Promise<TemplateState> {
  const mode = formData.get("wa_mode") === "submit" ? "submit" : formData.get("wa_mode") === "link" ? "link" : "none";
  const parsed = schema.safeParse({
    name: formData.get("name"),
    category: formData.get("category") || "umum",
    body: formData.get("body"),
    wa_template_name: mode === "none" ? "" : (formData.get("wa_template_name") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ctx = await requireContext();
  const { supabase, businessId } = ctx;
  const variables = extractVariables(parsed.data.body);
  let waName = parsed.data.wa_template_name;
  let waStatus: string | null = null;

  if (mode === "submit") {
    if (!isAdmin(ctx)) return { error: "Hanya owner/admin yang bisa mengajukan template ke Meta." };
    const r = await submitToMeta(businessId, { name: parsed.data.name, body: parsed.data.body, waName, category: formData.get("meta_category") });
    if (!r.ok) return { error: r.error };
    waName = r.waName;
    waStatus = r.status;
  }

  const { error } = await supabase.from("followup_templates").insert({
    business_id: businessId,
    ...parsed.data,
    wa_template_name: waName,
    variables,
    // Template WhatsApp memakai parameter posisi {{1}}, {{2}}, …: urutannya mengikuti urutan variabel di isi pesan.
    wa_param_map: waName ? Object.fromEntries(variables.map((v, i) => [String(i + 1), v])) : {},
    ...(waStatus ? { wa_status: waStatus, wa_status_checked_at: new Date().toISOString() } : {}),
    source: "app",
  });
  if (error) {
    return { error: waStatus ? `Template sudah diajukan ke Meta sebagai "${waName}", tapi gagal disimpan di sini. Tautkan manual dengan nama itu.` : "Gagal menyimpan template." };
  }
  // Template yang ditautkan manual: langsung ambil status Meta (abaikan bila WABA belum terhubung).
  if (mode === "link" && waName) await syncTemplateStatuses(createSupabaseAdmin(), businessId).catch(() => null);
  revalidatePath("/templates");
  return mode === "submit" ? { ok: true, message: "Template diajukan ke Meta. Biasanya direview dalam beberapa menit; status tampil di tabel." } : { ok: true };
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

export async function archiveTemplate(id: string): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(id).success) return { error: "Data tidak valid." };
  const { supabase, businessId } = await requireContext();
  const { error } = await supabase
    .from("followup_templates")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("business_id", businessId);
  if (error) return { error: "Gagal mengarsipkan template." };
  revalidatePath("/templates");
  return {};
}
