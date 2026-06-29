-- Direct messages (inbox) between CRM users, plus a members directory and realtime.
-- Builds on is_crm_member() from 20260623120000_crm_founder / 20260623130000_crm_reps.

create table if not exists public.crm_direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references auth.users(id),
  sender_name text,
  recipient_id uuid not null references auth.users(id),
  recipient_name text,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.crm_direct_messages enable row level security;

-- Send only as yourself, and only if you're a CRM member.
drop policy if exists crm_dm_insert on public.crm_direct_messages;
create policy crm_dm_insert on public.crm_direct_messages
  for insert with check (public.is_crm_member() and sender_id = auth.uid());

-- Read messages you sent or received.
drop policy if exists crm_dm_select on public.crm_direct_messages;
create policy crm_dm_select on public.crm_direct_messages
  for select using (
    public.is_crm_member() and (sender_id = auth.uid() or recipient_id = auth.uid())
  );

-- Recipient can mark their received messages read (read_at).
drop policy if exists crm_dm_update on public.crm_direct_messages;
create policy crm_dm_update on public.crm_direct_messages
  for update using (public.is_crm_member() and recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create index if not exists crm_dm_recipient_idx on public.crm_direct_messages (recipient_id, created_at desc);
create index if not exists crm_dm_thread_idx on public.crm_direct_messages (sender_id, recipient_id, created_at);

-- Directory of CRM members you can message (founder + reps). SECURITY DEFINER so it can
-- read profiles past their RLS, but it still requires the caller to be a CRM member.
create or replace function public.list_crm_members()
returns table(id uuid, name text, email text, is_founder boolean)
language sql
security definer
set search_path = public
as $$
  select p.id,
         coalesce(nullif(trim(p.full_name), ''), p.email) as name,
         p.email,
         coalesce(p.is_founder, false) as is_founder
  from public.profiles p
  where public.is_crm_member()
    and (coalesce(p.is_founder, false) = true or p.crm_role = 'rep')
  order by coalesce(p.is_founder, false) desc, name;
$$;

grant execute on function public.list_crm_members() to authenticated;

-- Realtime: stream inserts/updates for both the shared team chat and direct messages.
do $$
begin
  begin
    alter publication supabase_realtime add table public.crm_messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.crm_direct_messages;
  exception when duplicate_object then null;
  end;
end $$;

notify pgrst, 'reload schema';
