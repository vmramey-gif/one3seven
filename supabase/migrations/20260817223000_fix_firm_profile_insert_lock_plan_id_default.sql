-- Follow-up to 20260817220000: the insert-lock trigger forced plan_id to 'beta', which is not a
-- valid value under firm_profiles_plan_id_check (valid set: beta_pilot, starter,
-- underwriting_low/mid/high, enterprise -- see 20260812280000_fix_firm_profiles_plan_id_beta_mismatch.sql).
-- Live-tested against prod: a self-service firm_profiles insert was still correctly rejected,
-- because firm_code := null hits the NOT NULL constraint regardless -- but it failed on the wrong
-- constraint (plan_id_check) instead of the intended one, which would silently stop being true
-- defense-in-depth if the plan_id check constraint's valid set is ever widened later. Using a real
-- valid value here makes firm_code's NOT NULL constraint the actual, correct primary block.

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

  new.plan_id := 'beta_pilot';
  new.subscription_status := 'inactive';
  new.firm_code := null;
  return new;
end;
$$;
