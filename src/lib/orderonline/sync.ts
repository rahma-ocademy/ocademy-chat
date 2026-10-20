import "server-only";
import type { Admin } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";
import { getFollowupAutotext, getShippingTemplates, login } from "@/lib/orderonline/client";
import { buildOrderOnlineImport } from "@/lib/orderonline/import";

export type SyncResult = { templates: number; rulesAdded: number; presets: number };

/**
 * Impor template + aturan dari OrderOnline.
 * - Template (source=orderonline) selalu ditimpa dari sumbernya: read-only di aplikasi.
 * - Aturan hanya DITAMBAH (tidak menimpa) dan dibuat NONAKTIF, supaya perubahan penjual tidak hilang
 *   dan pelanggan tidak menerima pesan ganda sebelum penjual mematikan auto-WA di OrderOnline.
 */
export async function syncOrderOnline(admin: Admin, businessId: string, integrationId: string): Promise<SyncResult> {
  const { data: secret } = await admin
    .from("integration_secrets").select("ciphertext").eq("integration_id", integrationId).maybeSingle();
  if (!secret) throw new Error("Token OrderOnline belum tersimpan untuk integrasi ini.");

  const { accessToken } = await login(decryptSecret(secret.ciphertext));
  const [autotext, shipping] = await Promise.all([getFollowupAutotext(accessToken), getShippingTemplates(accessToken)]);
  const imported = buildOrderOnlineImport(autotext, shipping);

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
        .filter((r) => idByRef.has(r.external_ref))
        .map((r) => ({
          business_id: businessId,
          integration_id: integrationId,
          external_ref: r.external_ref,
          source: "orderonline",
          name: r.name,
          trigger_event: r.trigger_event,
          steps: [{ template_id: idByRef.get(r.external_ref)!, delay_minutes: r.delay_minutes, at_hour: r.at_hour }],
          stop_events: r.stop_events,
          active: false,
        })),
      { onConflict: "business_id,integration_id,external_ref", ignoreDuplicates: true },
    )
    .select("id");
  if (rErr) throw new Error(`Gagal menyimpan aturan: ${rErr.message}`);

  await admin.from("integrations").update({ last_synced_at: new Date().toISOString(), status: "connected" }).eq("id", integrationId);
  return { templates: imported.templates.length, rulesAdded: added?.length ?? 0, presets: imported.templates.filter((t) => t.preset).length };
}
