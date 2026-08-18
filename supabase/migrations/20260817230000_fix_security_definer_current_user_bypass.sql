-- CRITICAL FIX, caught by live-testing the 220000/223000 migrations against prod before declaring
-- them done: enforce_firm_profile_insert_lock (just added) and enforce_firm_profile_privilege_lock
-- (pre-existing since 20260809140000) are both declared SECURITY DEFINER. Under SECURITY DEFINER,
-- current_user resolves to the FUNCTION OWNER for the duration of the call, not the real calling
-- role -- so `current_user in ('service_role', 'supabase_admin', 'postgres')` silently matched on
-- EVERY invocation regardless of who was actually calling, and both triggers unconditionally
-- bypassed their own lock. Neither function needs elevated privileges (they only mutate NEW and
-- call is_founder(), itself SECURITY DEFINER + granted to authenticated), so the fix is to drop
-- SECURITY DEFINER entirely rather than swap to session_user, matching enforce_profile_privilege_lock's
-- style (that one was never SECURITY DEFINER and worked correctly in live testing).
--
-- Live-proven before this fix: an authenticated non-founder user could POST to
-- /rest/v1/firm_profiles with an explicit firm_code and get a real 201 with that exact code live
-- and routable -- neither the new insert lock nor (very likely, same bug, same age since 8/9) the
-- existing update lock were actually blocking anything. This migration is the real fix; 220000 and
-- 223000 were necessary but not sufficient on their own.

create or replace function public.enforce_firm_profile_insert_lock()
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

  new.plan_id := 'beta_pilot';
  new.subscription_status := 'inactive';
  new.firm_code := null;
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
