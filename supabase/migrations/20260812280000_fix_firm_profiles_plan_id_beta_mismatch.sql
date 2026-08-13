-- Real, live bug found 2026-08-12 while reviewing a real firm account's Settings page: the
-- database default for firm_profiles.plan_id has always been the literal string 'beta', but
-- every place in the frontend (billingService.ts's FirmPlanId type, the isPaid/isActive
-- derivation, the plan-label mapping) only ever checks for 'beta_pilot'. The two values have
-- never matched. Confirmed live consequence: getFirmSubscriptionStatus() computes
-- `isPaid = isActive && id !== 'beta_pilot'` -- for any firm sitting on the raw DB default
-- ('beta') with subscription_status = 'active', isPaid evaluates to true even though that firm
-- has never paid anything or gone through Stripe. Currently only drives a text-color change and
-- an incorrectly-shown "Manage billing" link (nothing more consequential reads .isPaid yet, per
-- a full grep), but it's a real data/code contract mismatch worth closing now, not after
-- something bigger gets gated on it.
--
-- Fix: backfill existing 'beta' rows to 'beta_pilot' (aligns real data with what the app has
-- always intended, including the account that surfaced this), change the column default so new
-- rows stop drifting, and add a CHECK constraint restricting plan_id to the exact enum the
-- frontend's FirmPlanId type defines -- so this specific class of drift (a stray string value
-- with no validation) can't silently recur for a different value either.

update public.firm_profiles set plan_id = 'beta_pilot' where plan_id = 'beta';

alter table public.firm_profiles alter column plan_id set default 'beta_pilot';

alter table public.firm_profiles
  add constraint firm_profiles_plan_id_check
  check (plan_id in ('beta_pilot', 'starter', 'underwriting_low', 'underwriting_mid', 'underwriting_high', 'enterprise'));
