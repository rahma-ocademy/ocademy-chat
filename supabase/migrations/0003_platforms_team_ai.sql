-- ocademy-chat: Connected Platforms (WhatsApp WABA + Coexistence), tim & undangan, AI agent.
-- Jalankan SETELAH 0002_inbox.sql.

-- ─── Tim: status, nama, izin per anggota ──────────────────────────────────
alter table public.memberships
  add column if not exists name text,
  add column if not exists status text not null default 'active' check (status in ('active','deactivated')),
  -- Izin global (pola Cekat): none | view | manage. Owner selalu manage (ditegakkan di user_perm()).
  add column if not exists permissions jsonb not null
    default '{"user_management":"none","billing":"none","security":"none"}'::jsonb;

-- Anggota nonaktif kehilangan akses ke seluruh data bisnis.
create or replace function public.is_member(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.business_id = p_business and m.user_id = auth.uid() and m.status = 'active'
  );
$$;

create or replace function public.is_admin(p_business uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.business_id = p_business and m.user_id = auth.uid() and m.status = 'active' and m.role in ('owner','admin')
  );
$$;

-- Level izin global anggota yang login: 'none' | 'view' | 'manage'.
create or replace function public.user_perm(p_business uuid, p_key text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select case when m.role = 'owner' then 'manage' else coalesce(m.permissions->>p_key, 'none') end
      from public.memberships m
     where m.business_id = p_business and m.user_id = auth.uid() and m.status = 'active'
  ), 'none');
$$;

-- Pengguna selalu bisa membaca keanggotaannya sendiri (termasuk yang nonaktif) agar aplikasi
-- bisa membedakan "dinonaktifkan" dari "belum punya bisnis".
create policy memberships_read_own on public.memberships for select to authenticated using (user_id = auth.uid());

-- ─── Undangan ─────────────────────────────────────────────────────────────
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  email text not null check (email = lower(email)),
  name text not null,
  role text not null default 'agent' check (role in ('admin','agent')),
  permissions jsonb not null default '{"user_management":"none","billing":"none","security":"none"}'::jsonb,
  token_hash text not null unique,          -- sha256 token; token asli hanya ada di link
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_business_idx on public.invitations(business_id, created_at desc);
-- Satu undangan terbuka per email per bisnis.
create unique index invitations_open_email_idx on public.invitations(business_id, email)
  where accepted_at is null and revoked_at is null;

alter table public.invitations enable row level security;
create policy invitations_read on public.invitations for select to authenticated
  using (public.user_perm(business_id, 'user_management') in ('view','manage'));
-- Tulis hanya lewat server (service role) setelah cek izin & kuota seat.

-- ─── AI agent ─────────────────────────────────────────────────────────────
create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  welcome_message text,
  style_preset text not null default 'friendly'
    check (style_preset in ('formal','friendly','empathetic','concise','educational')),
  communication text,
  conversation_flow text,
  rules text,
  additional_instructions jsonb not null default '[]'::jsonb,  -- [{condition, instruction}]
  routing jsonb not null default '{}'::jsonb,                  -- {transfer:{enabled,condition}, label:{enabled,condition}}
  config jsonb not null default '{}'::jsonb,                   -- lihat src/lib/ai/config.ts
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);
create index ai_agents_business_idx on public.ai_agents(business_id);

create table public.ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  agent_id uuid not null,
  kind text not null check (kind in ('text','qa')),
  title text,
  content text check (char_length(content) <= 20000),
  question text,
  answer text,
  created_at timestamptz not null default now(),
  foreign key (agent_id, business_id) references public.ai_agents(id, business_id) on delete cascade,
  check ((kind = 'text' and content is not null) or (kind = 'qa' and question is not null and answer is not null))
);
create index ai_knowledge_agent_idx on public.ai_knowledge(agent_id, created_at);

alter table public.ai_agents enable row level security;
alter table public.ai_knowledge enable row level security;
create policy ai_agents_read on public.ai_agents for select to authenticated using (public.is_member(business_id));
create policy ai_agents_write on public.ai_agents for all to authenticated
  using (public.is_admin(business_id)) with check (public.is_admin(business_id));
create policy ai_knowledge_read on public.ai_knowledge for select to authenticated using (public.is_member(business_id));
create policy ai_knowledge_write on public.ai_knowledge for all to authenticated
  using (public.is_admin(business_id)) with check (public.is_admin(business_id));

-- ─── Inbox: WhatsApp (WABA / Coexistence), AI agent, agen ─────────────────
alter table public.inboxes
  add column if not exists status text not null default 'connected'
    check (status in ('connected','pending','error','disconnected')),
  add column if not exists status_detail text,
  add column if not exists connection_mode text check (connection_mode in ('cloud_api','coexistence')),
  add column if not exists wa_phone_number_id text,
  add column if not exists wa_waba_id text,
  add column if not exists wa_display_phone text,
  add column if not exists wa_verified_name text,
  add column if not exists connected_at timestamptz,
  add column if not exists ai_agent_id uuid;

alter table public.inboxes add constraint inboxes_id_business_uq unique (id, business_id);
-- AI agent harus milik bisnis yang sama; menghapus agen hanya mengosongkan kolom ai_agent_id.
alter table public.inboxes add constraint inboxes_ai_agent_fk
  foreign key (ai_agent_id, business_id) references public.ai_agents(id, business_id) on delete set null (ai_agent_id);
-- Satu nomor WhatsApp hanya bisa terhubung ke satu inbox (routing webhook memakai kolom ini).
create unique index inboxes_wa_phone_idx on public.inboxes(wa_phone_number_id);
alter table public.inboxes add constraint inboxes_whatsapp_shape check (
  (type = 'whatsapp') = (connection_mode is not null and wa_phone_number_id is not null)
);

-- Token akses WhatsApp (terenkripsi AES-256-GCM). Tanpa policy = hanya service role.
create table public.channel_secrets (
  inbox_id uuid primary key references public.inboxes(id) on delete cascade,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);
alter table public.channel_secrets enable row level security;

-- Agen manusia yang ditempatkan di inbox (onboarding langkah 4).
create table public.inbox_members (
  inbox_id uuid not null,
  user_id uuid not null,
  business_id uuid not null,
  primary key (inbox_id, user_id),
  foreign key (inbox_id, business_id) references public.inboxes(id, business_id) on delete cascade,
  foreign key (business_id, user_id) references public.memberships(business_id, user_id) on delete cascade
);
alter table public.inbox_members enable row level security;
create policy inbox_members_read on public.inbox_members for select to authenticated using (public.is_member(business_id));
create policy inbox_members_write on public.inbox_members for all to authenticated
  using (public.is_admin(business_id)) with check (public.is_admin(business_id));

-- Pengaturan inbox hanya oleh owner/admin. Dari browser hanya livechat yang bisa dibuat, dan kolom
-- koneksi WhatsApp tidak bisa diubah (hanya server yang menulisnya setelah verifikasi ke Meta).
drop policy if exists inboxes_all on public.inboxes;
create policy inboxes_read on public.inboxes for select to authenticated using (public.is_member(business_id));
create policy inboxes_insert on public.inboxes for insert to authenticated
  with check (public.is_admin(business_id) and type = 'livechat');
create policy inboxes_update on public.inboxes for update to authenticated
  using (public.is_admin(business_id)) with check (public.is_admin(business_id));
revoke insert, update on public.inboxes from authenticated;
grant insert (business_id, type, name) on public.inboxes to authenticated;
grant update (name, active, ai_agent_id) on public.inboxes to authenticated;

-- Event webhook kanal yang belum dipetakan (mis. riwayat chat Coexistence) disimpan mentah.
create table public.channel_webhook_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  inbox_id uuid references public.inboxes(id) on delete cascade,
  field text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);
create index channel_webhook_events_inbox_idx on public.channel_webhook_events(inbox_id, received_at desc);
alter table public.channel_webhook_events enable row level security;
create policy channel_webhook_events_read on public.channel_webhook_events for select to authenticated
  using (business_id is not null and public.is_admin(business_id));

-- ─── Pesan: id eksternal (wamid), pengirim "phone" (Coexistence), alasan gagal ─
alter table public.messages
  add column if not exists external_id text,
  add column if not exists error text;
alter table public.messages add constraint messages_external_uq unique (business_id, external_id);
alter table public.messages drop constraint if exists messages_sender_type_check;
alter table public.messages add constraint messages_sender_type_check
  check (sender_type in ('contact','agent','ai','system','phone'));   -- phone = dibalas dari app WhatsApp Business di HP

alter table public.outbox_messages
  add column if not exists inbox_id uuid references public.inboxes(id) on delete set null,
  add column if not exists external_id text,
  add column if not exists error text,
  add column if not exists sent_at timestamptz;
