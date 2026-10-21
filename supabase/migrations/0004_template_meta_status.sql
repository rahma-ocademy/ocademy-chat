-- ocademy-chat: status persetujuan Meta untuk template follow-up yang memakai template WhatsApp.
-- Jalankan SETELAH 0003_platforms_team_ai.sql.
--
-- wa_status mengikuti nilai Meta (APPROVED, PENDING, REJECTED, PAUSED, DISABLED, IN_APPEAL, …) ditambah
-- NOT_FOUND bila nama template tidak ada di WABA. NULL = belum pernah dicek / tidak memakai template WhatsApp.

alter table public.followup_templates
  add column if not exists wa_status text,
  add column if not exists wa_status_reason text,
  add column if not exists wa_status_checked_at timestamptz;

create index if not exists followup_templates_wa_name_idx
  on public.followup_templates(business_id, wa_template_name)
  where wa_template_name is not null;
