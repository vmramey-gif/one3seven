-- Founder directive 2026-08-17: public signup must open worker-only. Anyone pretending to be an
-- attorney must not be able to reach real firm-side tools or data.
--
-- Investigated two real, currently-live gaps, deeper than the RoleSelectionScreen UI tile
-- (allowFirmRole is client-side only and was never a security boundary):
--
-- GAP 1 -- profiles.role: the privilege-lock trigger from 20260816180000 correctly restored the
-- ability to set role exactly once after the 8/12 outage, but it never distinguished WHICH role
-- the row owner may self-assign. Any authenticated user could commitProfileRoleForUser(user,
-- 'firm') on their first role commit and it would succeed.
--
-- GAP 2 (the more severe one) -- firm_profiles INSERT: "firm_profiles_insert_own" has always been
--   with check (profile_id = auth.uid())
-- with NO check against profiles.role at all, and the 8/9 privilege-lock trigger
-- (enforce_firm_profile_privilege_lock) only fires BEFORE UPDATE, never BEFORE INSERT. So any
-- authenticated user -- worker or otherwise -- could INSERT their own firm_profiles row directly
-- via the client, setting plan_id/subscription_status to whatever they want (e.g.
-- subscription_status='active', unlocking the paid damages/wage-exposure feature with no Stripe
-- payment) and choosing their own firm_code (a real, live intake-routing code), completely
-- independent of profiles.role. This was reachable today with nothing but the public signup form
-- and the browser console.
--
-- Fix: firm accounts become founder-provisioned only (service_role / is_founder, via the Supabase
-- dashboard directly -- no self-serve path remains, and no admin UI was built for this since it's
-- rare enough to do by hand). Row-owner self-service can still freely become 'worker'.

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
    if new.role = 'firm' then
      raise exception
        'profiles: role cannot be self-assigned as firm -- firm accounts are founder-provisioned only';
    end if;
    return new;
  end if;

  if coalesce(old.is_founder, false) = true then
    return new;
  end if;

  if new.is_founder is distinct from old.is_founder
     or new.crm_role is distinct from old.crm_role
     or new.approved is distinct from old.approved then
    raise exception
      'profiles: privilege columns (is_founder, crm_role, approved) cannot be changed by the row owner';
  end if;

  if new.role is distinct from old.role then
    if old.role is not null then
      raise exception 'profiles: role cannot be changed once set';
    end if;
    if new.role = 'firm' then
      raise exception
        'profiles: role cannot be self-assigned as firm -- firm accounts are founder-provisioned only';
    end if;
  end if;

  return new;
end;
$$;

-- Trigger declaration unchanged (same events, same function name) -- re-declaring keeps this
-- migration self-contained, matching the existing convention in this file family.
drop trigger if exists trg_profiles_privilege_lock on public.profiles;
create trigger trg_profiles_privilege_lock
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_privilege_lock();

-- GAP 2 fix: force the billing/routing columns to safe values on every row-owner INSERT.
-- firm_code has no default and is NOT NULL, so forcing it to null makes the insert itself fail
-- with a constraint violation -- a self-service firm_profiles row can no longer be created at all,
-- not just created inert. plan_id/subscription_status are forced to their existing safe defaults
-- as belt-and-suspenders in case firm_code's NOT NULL constraint is ever relaxed later.
create or replace function public.enforce_firm_profile_insert_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  if public.is_founder() then
    return new;
  end if;

  new.plan_id := 'beta';
  new.subscription_status := 'inactive';
  new.firm_code := null;
  return new;
end;
$$;

drop trigger if exists trg_firm_profiles_insert_lock on public.firm_profiles;
create trigger trg_firm_profiles_insert_lock
  before insert on public.firm_profiles
  for each row execute function public.enforce_firm_profile_insert_lock();
