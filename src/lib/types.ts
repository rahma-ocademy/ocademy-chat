import type { Condition } from "@/lib/followups/conditions";
import type { SendWindow, Step } from "@/lib/followups/schedule";

// Tipe baris tabel yang dipakai aplikasi (cerminan supabase/migrations/0001_init.sql).
export type Source = "app" | "api" | "orderonline";

export type TemplateRow = {
  id: string;
  business_id: string;
  name: string;
  category: string;
  body: string;
  variants: { bank?: string; cod?: string; instant?: string };
  variables: string[];
  channel: "whatsapp" | "any";
  wa_template_name: string | null;
  wa_param_map: Record<string, string>;
  /** Status persetujuan Meta (0004): APPROVED, PENDING, REJECTED, PAUSED, DISABLED, NOT_FOUND, … null = belum dicek. */
  wa_status: string | null;
  wa_status_reason: string | null;
  wa_status_checked_at: string | null;
  source: Source;
  integration_id: string | null;
  external_ref: string | null;
  version: number;
  status: "draft" | "active" | "archived";
  created_at: string;
  updated_at: string;
};

export type RuleRow = {
  id: string;
  business_id: string;
  name: string;
  trigger_event: string;
  conditions: Condition[];
  steps: Step[];
  stop_events: string[];
  stop_on_reply: boolean;
  send_window: SendWindow;
  max_per_day: number | null;
  source: Source;
  integration_id: string | null;
  external_ref: string | null;
  active: boolean;
  created_at: string;
};

export type JobRow = {
  id: string;
  business_id: string;
  rule_id: string | null;
  event_id: string | null;
  integration_id: string | null;
  dedupe_ref: string | null;
  step_index: number;
  template_id: string | null;
  progress_key: string | null;
  contact: { phone?: string; name?: string };
  data: Record<string, unknown>;
  scheduled_at: string;
  status: "pending" | "processing" | "sent" | "failed" | "cancelled" | "skipped";
  attempts: number;
  error: string | null;
};

export type IntegrationRow = {
  id: string;
  business_id: string;
  type: "orderonline" | "custom";
  name: string;
  status: "connected" | "error" | "disconnected";
  webhook_secret: string;
  last_synced_at: string | null;
  created_at: string;
};
