import "server-only";
import type { Admin } from "@/lib/supabase/server";
import { can, getEntitlements } from "@/lib/plans";
import { optionalEnv } from "@/lib/env";
import { decryptSecret } from "@/lib/crypto";
import { markProgress, login } from "@/lib/orderonline/client";
import { matchesConditions } from "@/lib/followups/conditions";
import { computeScheduledAt, DEFAULT_TZ } from "@/lib/followups/schedule";
import { renderTemplate, templateParams } from "@/lib/followups/variables";
import { ensureConversation, findSendingInbox, sendWhatsApp } from "@/lib/whatsapp/channel";
import type { JobRow, RuleRow, TemplateRow } from "@/lib/types";

export type IngestInput = {
  businessId: string;
  integrationId?: string | null;
  type: string;
  idempotencyKey: string;
  contact: { phone?: string; name?: string };
  data: Record<string, unknown>;
  raw?: unknown;
};

export type IngestResult = {
  duplicate: boolean;
  eventId?: string;
  jobsCreated: number;
  jobsCancelled: number;
  note?: string;
};

/** Terima satu event: simpan (idempoten), batalkan job yang berhenti karena event ini, jadwalkan job baru. */
export async function ingestEvent(admin: Admin, input: IngestInput, now = new Date()): Promise<IngestResult> {
  const { data: ev, error } = await admin
    .from("inbound_events")
    .insert({
      business_id: input.businessId,
      integration_id: input.integrationId ?? null,
      type: input.type,
      idempotency_key: input.idempotencyKey,
      contact: input.contact,
      data: input.data,
      raw: input.raw ?? null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { duplicate: true, jobsCreated: 0, jobsCancelled: 0 };
    throw new Error(`Gagal menyimpan event: ${error.message}`);
  }

  const orderRef = input.data.order_id !== undefined ? String(input.data.order_id) : null;

  // 1) Event ini menghentikan follow-up yang masih menunggu untuk order yang sama.
  let jobsCancelled = 0;
  if (orderRef) {
    const { data: stoppers } = await admin
      .from("followup_rules")
      .select("id")
      .eq("business_id", input.businessId)
      .contains("stop_events", [input.type]);
    const ids = (stoppers ?? []).map((r) => r.id as string);
    if (ids.length) {
      const { data: cancelled } = await admin
        .from("followup_jobs")
        .update({ status: "cancelled", error: `stopped_by:${input.type}` })
        .eq("business_id", input.businessId)
        .eq("dedupe_ref", orderRef)
        .eq("status", "pending")
        .in("rule_id", ids)
        .select("id");
      jobsCancelled = cancelled?.length ?? 0;
    }
  }

  // 2) Jadwalkan job baru hanya bila paket mengizinkan follow-up.
  const ent = await getEntitlements(admin, input.businessId);
  if (!can(ent, "followup")) {
    return { duplicate: false, eventId: ev.id, jobsCreated: 0, jobsCancelled, note: "plan_missing_followup" };
  }

  const { data: rules } = await admin
    .from("followup_rules")
    .select("*")
    .eq("business_id", input.businessId)
    .eq("active", true)
    .eq("trigger_event", input.type);

  const jobs: Record<string, unknown>[] = [];
  for (const rule of (rules ?? []) as RuleRow[]) {
    if (!matchesConditions(rule.conditions ?? [], { ...input.data, contact: input.contact })) continue;
    rule.steps.forEach((step, i) => {
      jobs.push({
        business_id: input.businessId,
        rule_id: rule.id,
        event_id: ev.id,
        integration_id: rule.integration_id,
        dedupe_ref: orderRef,
        step_index: i,
        template_id: step.template_id,
        progress_key: rule.integration_id ? (rule.external_ref?.split(":")[0] ?? null) : null, // "follow_up_1:<hash>…" → "follow_up_1"
        contact: input.contact,
        data: input.data,
        scheduled_at: computeScheduledAt(now, step, rule.send_window ?? { mode: "anytime" }).toISOString(),
      });
    });
  }
  if (jobs.length) {
    const { error: jobErr } = await admin.from("followup_jobs").insert(jobs);
    if (jobErr) throw new Error(`Gagal menjadwalkan follow-up: ${jobErr.message}`);
  }
  return { duplicate: false, eventId: ev.id, jobsCreated: jobs.length, jobsCancelled };
}

/** Pelanggan membalas → batalkan follow-up yang menunggu untuk nomor itu dari aturan ber-`stop_on_reply`. */
export async function cancelOnReply(admin: Admin, businessId: string, phone: string): Promise<number> {
  const { data: rules } = await admin
    .from("followup_rules")
    .select("id")
    .eq("business_id", businessId)
    .eq("stop_on_reply", true);
  const ids = (rules ?? []).map((r) => r.id as string);
  if (!ids.length) return 0;
  const { data } = await admin
    .from("followup_jobs")
    .update({ status: "cancelled", error: "customer_replied" })
    .eq("business_id", businessId)
    .eq("status", "pending")
    .eq("contact->>phone", phone)
    .in("rule_id", ids)
    .select("id");
  return data?.length ?? 0;
}

/** Pilih varian isi OrderOnline berdasarkan metode bayar; selain itu pakai isi utama (transfer bank). */
export function pickBody(t: Pick<TemplateRow, "body" | "variants">, data: Record<string, unknown>): string {
  const method = String(data.payment_method ?? "").toLowerCase();
  if (method.includes("cod") && t.variants.cod) return t.variants.cod;
  if (/(instant|e-?pay|ewallet|qris)/.test(method) && t.variants.instant) return t.variants.instant;
  return t.body;
}

export type ProcessSummary = { claimed: number; sent: number; skipped: number; failed: number; retried: number };

const MAX_ATTEMPTS = 3;

export async function processDueJobs(admin: Admin, opts: { limit?: number } = {}): Promise<ProcessSummary> {
  const { data, error } = await admin.rpc("claim_due_jobs", { p_limit: opts.limit ?? 25 });
  if (error) throw new Error(`claim_due_jobs gagal: ${error.message}`);
  const jobs = (data ?? []) as JobRow[];
  const summary: ProcessSummary = { claimed: jobs.length, sent: 0, skipped: 0, failed: 0, retried: 0 };

  for (const job of jobs) {
    try {
      const outcome = await processJob(admin, job);
      summary[outcome] += 1;
    } catch (e) {
      const message = (e as Error).message.slice(0, 500);
      if (job.attempts < MAX_ATTEMPTS) {
        await admin
          .from("followup_jobs")
          .update({ status: "pending", error: message, scheduled_at: new Date(Date.now() + job.attempts * 5 * 60_000).toISOString() })
          .eq("id", job.id);
        summary.retried += 1;
      } else {
        await admin.from("followup_jobs").update({ status: "failed", error: message }).eq("id", job.id);
        summary.failed += 1;
      }
    }
  }
  return summary;
}

async function finish(admin: Admin, id: string, patch: Record<string, unknown>) {
  const { error } = await admin.from("followup_jobs").update(patch).eq("id", id);
  if (error) throw new Error(`Gagal memperbarui job: ${error.message}`);
}

async function processJob(admin: Admin, job: JobRow): Promise<"sent" | "skipped" | "failed"> {
  const ent = await getEntitlements(admin, job.business_id);
  if (!can(ent, "followup")) {
    await finish(admin, job.id, { status: "skipped", error: "plan_missing_followup" });
    return "skipped";
  }

  const phone = job.contact.phone;
  if (!phone) {
    await finish(admin, job.id, { status: "skipped", error: "no_phone" });
    return "skipped";
  }

  const { data: tpl } = job.template_id
    ? await admin.from("followup_templates").select("*").eq("id", job.template_id).maybeSingle()
    : { data: null };
  const template = tpl as TemplateRow | null;
  if (!template || template.status !== "active") {
    await finish(admin, job.id, { status: "skipped", error: "template_unavailable" });
    return "skipped";
  }

  const { data: r } = job.rule_id
    ? await admin.from("followup_rules").select("max_per_day").eq("id", job.rule_id).maybeSingle()
    : { data: null };
  const maxPerDay = (r as { max_per_day: number | null } | null)?.max_per_day ?? null;
  if (maxPerDay) {
    const dayStart = new Date(new Date().toLocaleDateString("en-CA", { timeZone: DEFAULT_TZ }) + "T00:00:00+07:00");
    const { count } = await admin
      .from("followup_jobs")
      .select("id", { count: "exact", head: true })
      .eq("business_id", job.business_id)
      .eq("contact->>phone", phone)
      .eq("status", "sent")
      .gte("sent_at", dayStart.toISOString());
    if ((count ?? 0) >= maxPerDay) {
      await finish(admin, job.id, { status: "skipped", error: "max_per_day" });
      return "skipped";
    }
  }

  const vars = { ...job.data, customer_name: job.data.customer_name ?? job.contact.name };
  const { text, missing } = renderTemplate(pickBody(template, job.data), vars, { customer_name: "Kak" });
  if (missing.length) {
    await finish(admin, job.id, { status: "failed", error: `missing_variables:${missing.join(",")}` });
    return "failed";
  }

  // Ada inbox WhatsApp terhubung → kirim lewat Cloud API dan tampilkan di percakapan kontak.
  // Belum ada → tetap masuk antrean keluar (outbox_messages) seperti sebelumnya.
  const inbox = await findSendingInbox(admin, job.business_id);
  if (inbox) {
    // Di luar jendela 24 jam WhatsApp hanya menerima template yang disetujui Meta.
    const message = template.wa_template_name
      ? { template: template.wa_template_name, language: optionalEnv("WHATSAPP_TEMPLATE_LANGUAGE") ?? "id", params: templateParams(template.wa_param_map, vars) }
      : { text };
    const out = await sendWhatsApp(admin, inbox, phone, message);
    await admin.from("outbox_messages").insert({
      business_id: job.business_id,
      job_id: job.id,
      inbox_id: inbox.id,
      channel: "whatsapp",
      to_phone: phone,
      body: text,
      status: out.ok ? "sent" : "failed",
      external_id: out.ok ? out.externalId || null : null,
      error: out.ok ? null : out.error,
      sent_at: out.ok ? new Date().toISOString() : null,
    });
    if (!out.ok) {
      // Di luar jendela 24 jam tidak akan berhasil dengan mengulang → gagal permanen.
      if (out.outsideWindow) {
        await finish(admin, job.id, { status: "failed", rendered_body: text, error: "outside_24h_window" });
        return "failed";
      }
      throw new Error(out.error);
    }
    const { conversationId } = await ensureConversation(admin, inbox, phone, job.contact.name ?? null);
    await admin.from("messages").insert({
      business_id: job.business_id,
      conversation_id: conversationId,
      direction: "out",
      sender_type: "system",
      body: text,
      status: "sent",
      external_id: out.externalId || null,
    });
  } else {
    const { error: outErr } = await admin
      .from("outbox_messages")
      .insert({ business_id: job.business_id, job_id: job.id, channel: "whatsapp", to_phone: phone, body: text });
    if (outErr) throw new Error(`Gagal mengantrekan pesan: ${outErr.message}`);
  }

  await finish(admin, job.id, { status: "sent", rendered_body: text, sent_at: new Date().toISOString(), error: null });
  await syncProgress(admin, job).catch(() => undefined); // best effort; tidak boleh menggagalkan pengiriman
  return "sent";
}

async function syncProgress(admin: Admin, job: JobRow) {
  if (optionalEnv("ORDERONLINE_SYNC_PROGRESS") !== "true") return;
  if (!job.integration_id || !job.progress_key || !job.dedupe_ref) return;
  const { data } = await admin.from("integration_secrets").select("ciphertext").eq("integration_id", job.integration_id).maybeSingle();
  if (!data) return;
  const { accessToken } = await login(decryptSecret(data.ciphertext));
  await markProgress(accessToken, job.dedupe_ref, job.progress_key);
}
