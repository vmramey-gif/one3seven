-- Internal team chat for the CRM: founder + invited sales reps share one channel.
-- Read/write is limited to CRM members (founder or rep) via is_crm_member(). No worker/firm/anon.

create table if not exists public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  sender_name text,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.crm_messages enable row level security;

drop policy if exists "crm_messages_member_read" on public.crm_messages;
create policy "crm_messages_member_read" on public.crm_messages
  for select to authenticated using (public.is_crm_member());

drop policy if exists "crm_messages_member_insert" on public.crm_messages;
create policy "crm_messages_member_insert" on public.crm_messages
  for insert to authenticated with check (public.is_crm_member() and sender_id = auth.uid());

create index if not exists crm_messages_created_idx on public.crm_messages(created_at);

notify pgrst, 'reload schema';
