-- ocademy-chat: skema awal (MVP Tahap A + Followups)
-- Jalankan lewat Supabase SQL editor atau `supabase db push`.

create extension if not exists pgcrypto;

-- ─── Paket & entitlement ──────────────────────────────────────────────────
create table public.plans (
  id text primary key,
  name text not null,
  price_idr integer not null default 0,
  limits jsonb not null default '{}'::jsonb,   -- seats, contacts_mau, ai_credits, waba_count
  features text[] not null default '{}'         -- open_api, followup, analytics, ...
);

insert into public.plans (id, name, price_idr, limits, features) values
  ('free',   'Free',    0,
    '{"seats":2,"contacts_mau":20,"ai_credits":100,"waba_count":0}',
    '{open_api,followup}'),
  ('plan_1', 'Paket 1', 0,
    '{"seats":5,"contacts_mau":3000,"ai_credits":15000,"waba_count":1}',
    '{open_api,analytics}'),
  ('plan_2', 'Paket 2', 0,
    '{"seats":7,"contacts_mau":10000,"ai_credits":50000,"waba_count":3}',
    '{open_api,analytics,followup,ticketing,flow}'),
  ('plan_3', 'Paket 3', 0,
    '{"seats":10,"contacts_mau":30000,"ai_credits":150000,"waba_count":5}',
    '{open_api,analytics,followup,ticketing,flow,automation,csat}'),
  ('custom', 'Custom',  0,
    '{}',
    '{open_api,analytics,followup,ticketing,flow,automation,csat,ai_full}');

-- ─── Tenant ───────────────────────────────────────────────────────────────
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'agent' check (role in ('owner','admin','agent')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

create table public.subscriptions (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  plan_id text not null references public.plans(id),
  status text not null default 'active' check (status in ('active','past_due','canceled')),
  period_start timestamptz not null default date_trunc('month', now()),
  period_end timestamptz not null default (date_trunc('month', now()) + interval '1 month')
);

create table public.usage_counters (
  business_id uuid not null references public.businesses(id) on delete cascade,
  key text not null,        -- ai_credits | contacts_mau | followups_sent
  period text not null,     -- YYYY-MM
  used integer not null default 0,
  primary key (business_id, key, period)
);

-- ─── Helper RLS ───────────────────────────────────────────────────────────
create or replace function public.is_member(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.business_id = p_business and m.user_id = auth.uid()
  );
$$;

-- Dibuat saat pendaftaran: bisnis + keanggotaan owner + langganan Free.
create or replace function public.bootstrap_business(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.businesses(name) values (coalesce(nullif(trim(p_name), ''), 'Bisnis saya')) returning id into v_id;
  insert into public.memberships(business_id, user_id, role) values (v_id, auth.uid(), 'owner');
  insert into public.subscriptions(business_id, plan_id) values (v_id, 'free');
  return v_id;
end $$;
grant execute on function public.bootstrap_business(text) to authenticated;

-- Potong kuota secara atomik. Hanya service role (server) yang boleh memanggil.
create or replace function public.consume_usage(p_business uuid, p_key text, p_period text, p_n integer, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_used integer;
begin
  insert into public.usage_counters(business_id, key, period, used)
  values (p_business, p_key, p_period, 0) on conflict do nothing;
  update public.usage_counters
     set used = used + p_n
   where business_id = p_business and key = p_key and period = p_period
     and (p_limit is null or used + p_n <= p_limit)
  returning used into v_used;
  return v_used is not null;
end $$;
revoke all on function public.consume_usage(uuid, text, text, integer, integer) from public, anon, authenticated;

-- ─── Integrasi & API key ──────────────────────────────────────────────────
create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null check (type in ('orderonline','custom')),
  name text not null,
  status text not null default 'connected' check (status in ('connected','error','disconnected')),
  webhook_secret text not null default encode(gen_random_bytes(24), 'hex'),
  last_synced_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index integrations_webhook_secret_idx on public.integrations(webhook_secret);
create index integrations_business_idx on public.integrations(business_id);

-- Rahasia terenkripsi (token OrderOnline). Tanpa policy = hanya service role.
create table public.integration_secrets (
  integration_id uuid primary key references public.integrations(id) on delete cascade,
  ciphertext text not null
);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  scopes text[] not null default '{templates:read,events:write}',
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index api_keys_business_idx on public.api_keys(business_id);

-- ─── Followups ────────────────────────────────────────────────────────────
create table public.followup_templates (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  category text not null default 'umum',
  body text not null,
  variants jsonb not null default '{}'::jsonb,  -- {bank,cod,instant} untuk template OrderOnline
  variables text[] not null default '{}',
  channel text not null default 'whatsapp' check (channel in ('whatsapp','any')),
  wa_template_name text,
  wa_param_map jsonb not null default '{}'::jsonb,
  source text not null default 'app' check (source in ('app','api','orderonline')),
  integration_id uuid references public.integrations(id) on delete set null,
  external_ref text,
  version integer not null default 1,
  status text not null default 'active' check (status in ('draft','active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index followup_templates_business_idx on public.followup_templates(business_id);
-- NULL dianggap berbeda: template buatan aplikasi (external_ref null) tidak saling bentrok.
alter table public.followup_templates
  add constraint followup_templates_external_uq unique (business_id, integration_id, external_ref);

create table public.followup_rules (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  trigger_event text not null,
  conditions jsonb not null default '[]'::jsonb,        -- [{field, op, value}]
  steps jsonb not null default '[]'::jsonb,             -- [{template_id, delay_minutes}]
  stop_events text[] not null default '{}',
  stop_on_reply boolean not null default true,
  send_window jsonb not null default '{"mode":"anytime"}'::jsonb,
  max_per_day integer,
  source text not null default 'app' check (source in ('app','api','orderonline')),
  integration_id uuid references public.integrations(id) on delete set null,
  external_ref text,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index followup_rules_business_idx on public.followup_rules(business_id, active, trigger_event);
alter table public.followup_rules
  add constraint followup_rules_external_uq unique (business_id, integration_id, external_ref);

create table public.inbound_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  type text not null,
  idempotency_key text not null,
  contact jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  raw jsonb,
  received_at timestamptz not null default now(),
  unique (business_id, idempotency_key)
);

create table public.followup_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  rule_id uuid references public.followup_rules(id) on delete set null,
  event_id uuid references public.inbound_events(id) on delete set null,
  integration_id uuid references public.integrations(id) on delete set null,
  dedupe_ref text,                       -- mis. order_id, dipakai untuk membatalkan job saat event berhenti
  step_index integer not null default 0,
  template_id uuid references public.followup_templates(id) on delete set null,
  progress_key text,                     -- kunci progres OrderOnline (follow_up_1, ...)
  contact jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','processing','sent','failed','cancelled','skipped')),
  attempts integer not null default 0,
  error text,
  rendered_body text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index followup_jobs_due_idx on public.followup_jobs(scheduled_at) where status = 'pending';
create index followup_jobs_ref_idx on public.followup_jobs(business_id, dedupe_ref) where status = 'pending';

-- Antrean keluar. Belum ada penyedia WhatsApp: baris ini yang nanti dikirim oleh driver kanal.
create table public.outbox_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  job_id uuid references public.followup_jobs(id) on delete set null,
  channel text not null default 'whatsapp',
  to_phone text,
  body text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  created_at timestamptz not null default now()
);

-- Ambil job jatuh tempo dan tandai 'processing' secara atomik (aman untuk beberapa worker).
create or replace function public.claim_due_jobs(p_limit integer)
returns setof public.followup_jobs language sql security definer set search_path = public as $$
  update public.followup_jobs j
     set status = 'processing', attempts = attempts + 1
   where j.id in (
     select id from public.followup_jobs
      where status = 'pending' and scheduled_at <= now()
      order by scheduled_at
      limit p_limit
      for update skip locked)
  returning j.*;
$$;
revoke all on function public.claim_due_jobs(integer) from public, anon, authenticated;

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.plans enable row level security;
alter table public.businesses enable row level security;
alter table public.memberships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.integrations enable row level security;
alter table public.integration_secrets enable row level security;
alter table public.api_keys enable row level security;
alter table public.followup_templates enable row level security;
alter table public.followup_rules enable row level security;
alter table public.inbound_events enable row level security;
alter table public.followup_jobs enable row level security;
alter table public.outbox_messages enable row level security;

create policy plans_read on public.plans for select to authenticated using (true);

create policy businesses_read on public.businesses for select to authenticated using (public.is_member(id));
create policy businesses_update on public.businesses for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

create policy memberships_read on public.memberships for select to authenticated using (public.is_member(business_id));
create policy subscriptions_read on public.subscriptions for select to authenticated using (public.is_member(business_id));
create policy usage_read on public.usage_counters for select to authenticated using (public.is_member(business_id));

create policy integrations_all on public.integrations for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy api_keys_all on public.api_keys for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy templates_all on public.followup_templates for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy rules_all on public.followup_rules for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));

create policy events_read on public.inbound_events for select to authenticated using (public.is_member(business_id));
create policy jobs_read on public.followup_jobs for select to authenticated using (public.is_member(business_id));
create policy outbox_read on public.outbox_messages for select to authenticated using (public.is_member(business_id));
-- integration_secrets: sengaja tanpa policy (hanya service role).
