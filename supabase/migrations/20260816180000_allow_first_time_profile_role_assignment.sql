-- LIVE INCIDENT FIX -- the privilege-lock trigger from 20260812140000 correctly closed a real
-- privilege-escalation hole (is_founder/crm_role/approved/role were all self-updatable due to a
-- broken SECURITY DEFINER current_user check), but it bundled the ONE-TIME, legitimate initial
-- role choice (worker vs firm, made on RoleSelectionScreen right after signup) into the same lock
-- as later role changes. Every new signup since 2026-08-12 has been unable to complete role
-- selection: commitProfileRoleForUser() creates the profiles row via INSERT with role=null (role
-- isn't known yet), then sets it via UPDATE once the user picks -- and that UPDATE has been
-- rejected by this trigger for four days. Live-reproduced against prod with a fresh throwaway
-- account before writing this fix: repeated 400s, "profiles: privilege columns (is_founder,
-- crm_role, approved, role) cannot be changed by the row owner".
--
-- Fix: allow the row owner to set role exactly once (old.role is null -> new.role = something).
-- Once role is set, it is permanently immutable by the row owner again, same as before -- this is
-- actually a strictly stronger security posture than pre-8/12, since there was never a supported
-- "switch role" feature and locking it after the first commit closes that path for good.
-- is_founder/crm_role/approved are untouched -- those must never be self-service-settable, not
-- even once, and the INSERT branch above already forces them false/null regardless of INSERT
-- payload.

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
     or (new.role is distinct from old.role and old.role is not null) then
    raise exception
      'profiles: privilege columns (is_founder, crm_role, approved, role) cannot be changed by the row owner';
  end if;

  return new;
end;
$$;

-- Trigger itself is unchanged (same events, same function name) -- re-declaring makes this
-- migration self-contained and independently re-appliable, matching the existing convention.
drop trigger if exists trg_profiles_privilege_lock on public.profiles;
create trigger trg_profiles_privilege_lock
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_privilege_lock();
