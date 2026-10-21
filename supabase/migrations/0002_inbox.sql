-- ocademy-chat: Inbox (channel, kontak, percakapan, pesan, label)
-- Jalankan SETELAH 0001_init.sql.

-- ─── Identitas agen yang bisa ditampilkan (auth.users tidak terbaca lewat RLS) ──
alter table public.memberships add column if not exists email text;
update public.memberships m set email = u.email from auth.users u where u.id = m.user_id and m.email is null;

create or replace function public.bootstrap_business(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into public.businesses(name) values (coalesce(nullif(trim(p_name), ''), 'Bisnis saya')) returning id into v_id;
  insert into public.memberships(business_id, user_id, role, email)
    values (v_id, auth.uid(), 'owner', (select email from auth.users where id = auth.uid()));
  insert into public.subscriptions(business_id, plan_id) values (v_id, 'free');
  return v_id;
end $$;

-- ─── Channel ──────────────────────────────────────────────────────────────
create table public.inboxes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  type text not null check (type in ('livechat','whatsapp','api')),
  name text not null,
  widget_key text not null default encode(gen_random_bytes(16), 'hex'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index inboxes_widget_key_idx on public.inboxes(widget_key);
create index inboxes_business_idx on public.inboxes(business_id);

-- ─── Kontak ───────────────────────────────────────────────────────────────
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text,
  phone text,
  email text,
  external_id text,           -- mis. lc:<sha256 token pengunjung livechat>
  created_at timestamptz not null default now(),
  unique (business_id, external_id)
);
create index contacts_phone_idx on public.contacts(business_id, phone);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,
  color text not null default '#293867',
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

-- ─── Percakapan & pesan ───────────────────────────────────────────────────
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  inbox_id uuid not null references public.inboxes(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  status text not null default 'open' check (status in ('open','resolved')),
  assignee_id uuid references auth.users(id) on delete set null,
  unread_count integer not null default 0,
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index conversations_list_idx on public.conversations(business_id, status, last_message_at desc);
create index conversations_contact_idx on public.conversations(contact_id, inbox_id);

create table public.conversation_labels (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  primary key (conversation_id, label_id)
);
create index conversation_labels_label_idx on public.conversation_labels(label_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction text not null check (direction in ('in','out')),
  sender_type text not null check (sender_type in ('contact','agent','ai','system')),
  sender_id uuid references auth.users(id) on delete set null,
  is_private boolean not null default false,   -- catatan internal: tidak pernah dikirim ke pelanggan
  body text not null check (char_length(body) between 1 and 4096),
  status text not null default 'sent' check (status in ('received','queued','sent','delivered','read','failed')),
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages(conversation_id, created_at);

-- Ringkasan percakapan dirawat di satu tempat: trigger ini (bukan di setiap kode yang menulis pesan).
create or replace function public.on_message_inserted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations c
     set last_message_at = new.created_at,
         last_message_preview = case when new.is_private then c.last_message_preview else left(new.body, 140) end,
         unread_count = c.unread_count + case when new.direction = 'in' then 1 else 0 end,
         status = case when new.direction = 'in' and c.status = 'resolved' then 'open' else c.status end,
         resolved_at = case when new.direction = 'in' and c.status = 'resolved' then null else c.resolved_at end,
         resolved_by = case when new.direction = 'in' and c.status = 'resolved' then null else c.resolved_by end
   where c.id = new.conversation_id;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.on_message_inserted();

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.inboxes enable row level security;
alter table public.contacts enable row level security;
alter table public.labels enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_labels enable row level security;
alter table public.messages enable row level security;

create policy inboxes_all on public.inboxes for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy contacts_all on public.contacts for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy labels_all on public.labels for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy conversations_all on public.conversations for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));
create policy conversation_labels_all on public.conversation_labels for all to authenticated
  using (public.is_member(business_id)) with check (public.is_member(business_id));

create policy messages_read on public.messages for select to authenticated using (public.is_member(business_id));
-- Agen hanya boleh menulis pesan KELUAR atas namanya sendiri; pesan masuk hanya dari server (channel).
create policy messages_agent_insert on public.messages for insert to authenticated
  with check (public.is_member(business_id) and direction = 'out' and sender_type = 'agent' and sender_id = auth.uid());

-- ─── Realtime (Supabase) ──────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.conversations;
  end if;
end $$;
