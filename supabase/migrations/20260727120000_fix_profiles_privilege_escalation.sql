-- P0 privilege-escalation fix (task_176287cb) — APPLY BEFORE ONBOARDING ANY REAL FIRM.
--
-- Root cause: policy "profiles_update_own" was
--     for update using (auth.uid() = id)
-- with NO with-check and NO column restriction. A signed-in user could PATCH their own
-- profiles row through the PostgREST API and set privileged columns:
--   is_founder = true  -> public.is_founder() trusts this column, granting the attacker
--                         USING/WITH CHECK on every founder-gated table (crm_firms,
--                         crm_activity, crm_messages, crm_notes, demo_debriefs, web_events,
--                         and the CRM-synced pilot_interest PII).
--   crm_role = 'rep'   -> CRM member access.
--   approved = true    -> bypasses the account-approval gate.
--   role = 'firm'      -> role confusion.
--
-- Fix: keep the owner UPDATE path, but (1) recreate the policy WITH CHECK, and (2) add a
-- BEFORE UPDATE trigger that freezes the privilege columns unless the caller is the service
-- role or an existing founder. Belt-and-suspenders: REVOKE column-level UPDATE from
-- authenticated so even a future policy regression cannot re-open this. Mirrors the guard
-- pattern in 20260610120000_prevent_firm_route_escalation.sql.

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.enforce_profile_privilege_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role (edge functions / admin) and superuser bypass the lock: legitimate
  -- founder onboarding, rep invites, and approval flows run with elevated privilege.
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  -- An existing founder may change these columns (grant/revoke rep access, approve users).
  if coalesce(old.is_founder, false) = true then
    return new;
  end if;

  -- Otherwise the row owner may NOT change any privilege column.
  if new.is_founder is distinct from old.is_founder
     or new.crm_role is distinct from old.crm_role
     or new.approved is distinct from old.approved
     or new.role is distinct from old.role then
    raise exception
      'profiles: privilege columns (is_founder, crm_role, approved, role) cannot be changed by the row owner';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_privilege_lock on public.profiles;
create trigger trg_profiles_privilege_lock
  before update on public.profiles
  for each row execute function public.enforce_profile_privilege_lock();

-- Belt-and-suspenders: authenticated users cannot write these columns at all, so even a
-- policy regression cannot re-open the escalation. (Owner-editable columns stay writable.)
revoke update (is_founder, crm_role, approved, role) on public.profiles from authenticated;
