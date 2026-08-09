-- Sibling of 20260727120000_fix_profiles_privilege_escalation.sql — the same class of bug,
-- same table family, never patched here.
--
-- Root cause: "firm_profiles_update_own" was
--     for update using (auth.uid() = profile_id)
-- with NO with-check and NO column restriction. A signed-in firm user could PATCH their own
-- firm_profiles row through the PostgREST API and set billing-controlling columns directly:
--   plan_id             -> self-upgrade to a higher tier (e.g. unlocks the wage-exposure/damages
--                          feature gated by firmTierIncludesDamagesFeature) without paying.
--   subscription_status -> set to 'active' regardless of actual Stripe state.
--   firm_code           -> the unique code workers use to route intakes to this firm; changing it
--                          breaks inbound links/QR codes pointing at the old code.
-- These three should only ever change via the Stripe webhook or a founder action (service role),
-- never directly by the firm. firm_name / contact_email / practice_areas / geographic_filters
-- remain owner-editable — legitimate self-service profile edits.

drop policy if exists "firm_profiles_update_own" on public.firm_profiles;
create policy "firm_profiles_update_own" on public.firm_profiles
  for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create or replace function public.enforce_firm_profile_privilege_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role (Stripe webhook / edge functions / admin) and superuser bypass the lock.
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  -- A founder acting through the CRM may change these (manual plan overrides, code fixes).
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

drop trigger if exists trg_firm_profiles_privilege_lock on public.firm_profiles;
create trigger trg_firm_profiles_privilege_lock
  before update on public.firm_profiles
  for each row execute function public.enforce_firm_profile_privilege_lock();

-- Belt-and-suspenders: authenticated users cannot write these columns at all, so even a
-- policy regression cannot re-open the escalation.
revoke update (plan_id, subscription_status, firm_code) on public.firm_profiles from authenticated;
