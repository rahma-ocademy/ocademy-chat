import "server-only";
import type { Admin } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { listProducts, login } from "@/lib/orderonline/client";
import { buildOrderOnlineImport } from "@/lib/orderonline/import";

export type SyncResult = { products: number; templates: number; rulesAdded: number };

/**
 * Impor template + aturan dari follow-up per produk di OrderOnline.
 * - Template (source=orderonline) selalu ditimpa dari sumbernya: read-only di aplikasi.
 * - Aturan baru dibuat NONAKTIF, supaya pelanggan tidak menerima pesan ganda sebelum penjual mematikan
 *   auto-WA di OrderOnline. Aturan yang sudah ada tidak ditimpa; hanya daftar produk (kondisi) & namanya diperbarui.
 */
export async function syncOrderOnline(admin: Admin, businessId: string, integrationId: string): Promise<SyncResult> {
  const { data: secret } = await admin
    .from("integration_secrets").select("ciphertext").eq("integration_id", integrationId).maybeSingle();
  if (!secret) throw new Error("Token OrderOnline belum tersimpan untuk integrasi ini.");

  const { accessToken } = await login(decryptSecret(secret.ciphertext));
  const products = await listProducts(accessToken);
  const imported = buildOrderOnlineImport(products);

  const { data: tpls, error: tErr } = await admin
    .from("followup_templates")
    .upsert(
      imported.templates.map((t) => ({
        business_id: businessId,
        integration_id: integrationId,
        external_ref: t.external_ref,
        source: "orderonline",
        name: t.name,
        category: t.category,
        body: t.body,
        variants: t.variants,
        variables: t.variables,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "business_id,integration_id,external_ref" },
    )
    .select("id, external_ref");
  if (tErr) throw new Error(`Gagal menyimpan template: ${tErr.message}`);
  const idByRef = new Map((tpls ?? []).map((t) => [t.external_ref as string, t.id as string]));

  const { data: added, error: rErr } = await admin
    .from("followup_rules")
    .upsert(
      imported.rules
        .filter((r) => idByRef.has(r.template_ref))
        .map((r) => ({
          business_id: businessId,
          integration_id: integrationId,
          external_ref: r.external_ref,
          source: "orderonline",
          name: r.name,
          trigger_event: r.trigger_event,
          conditions: r.conditions,
          steps: [{ template_id: idByRef.get(r.template_ref)!, delay_minutes: r.delay_minutes, at_hour: r.at_hour }],
          stop_events: r.stop_events,
          active: false,
        })),
      { onConflict: "business_id,integration_id,external_ref", ignoreDuplicates: true },
    )
    .select("id");
  if (rErr) throw new Error(`Gagal menyimpan aturan: ${rErr.message}`);

  // Produk baru yang memakai teks & jadwal yang sama ikut tercakup aturan yang sudah ada.
  const addedIds = new Set((added ?? []).map((r) => r.id as string));
  const { data: existing } = await admin
    .from("followup_rules").select("id, external_ref").eq("integration_id", integrationId).eq("source", "orderonline");
  const byRef = new Map(imported.rules.map((r) => [r.external_ref, r]));
  for (const row of existing ?? []) {
    const r = byRef.get(row.external_ref as string);
    if (!r || addedIds.has(row.id as string)) continue;
    await admin.from("followup_rules").update({ conditions: r.conditions, name: r.name }).eq("id", row.id);
  }

  await admin.from("integrations").update({ last_synced_at: new Date().toISOString(), status: "connected" }).eq("id", integrationId);
  return { products: products.length, templates: imported.templates.length, rulesAdded: added?.length ?? 0 };
}
