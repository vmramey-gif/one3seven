-- Sales reps for the CRM (easy/email path — no SMS provider needed).
-- Founder invites reps by email (allowlist); a rep who signs in with an invited email is
-- granted CRM access. Founder manages reps; reps share one team pipeline.

-- Rep role marker on profiles (founder is identified by is_founder, reps by crm_role = 'rep').
alter table public.profiles add column if not exists crm_role text check (crm_role is null or crm_role = 'rep');

-- Email allowlist of invited reps. Founder-managed only.
create table if not exists public.crm_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  status text not null default 'invited' check (status in ('invited', 'accepted', 'revoked')),
  created_at timestamptz not null default now()
);
alter table public.crm_invites enable row level security;
drop policy if exists "crm_invites_founder_all" on public.crm_invites;
create policy "crm_invites_founder_all" on public.crm_invites
  for all to authenticated using (public.is_founder()) with check (public.is_founder());

-- CRM membership = founder OR an active rep. SECURITY DEFINER to avoid profiles-RLS recursion.
create or replace function public.is_crm_member()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce(
    (select p.is_founder or p.crm_role = 'rep' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;
grant execute on function public.is_crm_member() to authenticated;

-- A signed-in user whose own email matches a non-revoked invite is provisioned as a rep.
-- SECURITY DEFINER so it can flip the flag — but only ever for the caller's own matching email,
-- so a user can neither self-invite (crm_invites is founder-only) nor grant anyone else.
create or replace function public.claim_crm_rep_access()
returns boolean language plpgsql security definer set search_path = public as $$
declare matched boolean;
begin
  select exists (
    select 1 from public.crm_invites i
    where lower(i.email) = lower(auth.email()) and i.status in ('invited', 'accepted')
  ) into matched;
  if matched then
    update public.profiles set crm_role = 'rep'
      where id = auth.uid() and (crm_role is distinct from 'rep');
    update public.crm_invites set status = 'accepted'
      where lower(email) = lower(auth.email()) and status = 'invited';
  end if;
  return matched;
end;
$$;
grant execute on function public.claim_crm_rep_access() to authenticated;

-- Widen CRM data access from founder-only to any CRM member (founder or rep).
drop policy if exists "crm_firms_founder_all" on public.crm_firms;
drop policy if exists "crm_firms_member_all" on public.crm_firms;
create policy "crm_firms_member_all" on public.crm_firms
  for all to authenticated using (public.is_crm_member()) with check (public.is_crm_member());

drop policy if exists "crm_activity_founder_all" on public.crm_activity;
drop policy if exists "crm_activity_member_all" on public.crm_activity;
create policy "crm_activity_member_all" on public.crm_activity
  for all to authenticated using (public.is_crm_member()) with check (public.is_crm_member());

notify pgrst, 'reload schema';
