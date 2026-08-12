-- CRITICAL fix (independent adversarial security review, 2026-08-12) — the privilege-lock
-- triggers added by 20260727120000 (profiles) and 20260809140000 (firm_profiles), and the
-- INSERT-time extension added earlier today by 20260812120000, have NEVER actually worked.
--
-- Root cause: both trigger functions are declared `security definer` and contain
--     if current_user in ('service_role', 'supabase_admin', 'postgres') then return new; end if;
-- Inside a SECURITY DEFINER function, `current_user` evaluates to the FUNCTION'S OWNER for
-- the duration of that function call — not the role of whoever is actually calling it. The
-- functions are owned by the migration-runner role (postgres/supabase_admin), so that
-- condition is unconditionally TRUE on every single invocation, for every caller, including
-- a plain authenticated user hitting PostgREST with their own access token. Every "only
-- service_role may bypass" check has therefore always let everyone through, silently. Live-
-- verified: a freshly created test user could set is_founder=true / crm_role='rep' /
-- approved=true directly via the REST API even after 20260812120000 supposedly re-added
-- protection on INSERT — root-caused to this bug, not to a migration failing to apply.
--
-- Fix: these functions do not touch any other table and do not need elevated privilege to
-- read/write NEW and OLD or raise an exception, so SECURITY DEFINER was never necessary.
-- Dropping it makes them SECURITY INVOKER (the default), so current_user correctly reflects
-- whatever role PostgREST actually put the statement under (service_role / authenticated /
-- postgres), and the bypass check starts working as originally intended.

create or replace function public.enforce_profile_privilege_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_founder := false;
    new.crm_role := null;
    new.approved := false;
    return new;
  end if;

  if coalesce(old.is_founder, false) = true then
    return new;
  end if;

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

create or replace function public.enforce_firm_profile_privilege_lock()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  if public.is_founder() then
    return new;
  end if;

  if new.plan_id is distinct from old.plan_id
     or new.subscription_status is distinct from old.subscription_status
     or new.firm_code is distinct from old.firm_code then
    raise exception
      'firm_profiles: plan_id, subscription_status, and firm_code cannot be changed by the row owner';
  end if;

  return new;
end;
$$;

-- Triggers are unchanged (still fire on the same events) — only the function bodies changed,
-- but re-declaring them makes the fix self-contained and independently re-appliable.
drop trigger if exists trg_profiles_privilege_lock on public.profiles;
create trigger trg_profiles_privilege_lock
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_privilege_lock();

drop trigger if exists trg_firm_profiles_privilege_lock on public.firm_profiles;
create trigger trg_firm_profiles_privilege_lock
  before update on public.firm_profiles
  for each row execute function public.enforce_firm_profile_privilege_lock();

-- Remove the temporary diagnostic RPC added by 20260812130000 — was only needed to debug this
-- issue live, has no place staying granted to anon/authenticated in production.
drop function if exists public.debug_profiles_trigger_state();
