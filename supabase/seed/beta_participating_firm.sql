-- Beta participating routing setup (run in Supabase SQL editor after migrations).
-- Does NOT create routes or fake firm interest — only makes firm_profiles eligible to receive previews.
--
-- Prerequisite: at least one firm_profiles row (create by signing in as a firm in the app).

-- 1) Apply migration 20260528120000_participating_routing_beta.sql (RPC + eligibility update).

-- 2) Ensure existing firms can receive participating previews:
update public.firm_profiles
set subscription_status = 'active'
where coalesce(subscription_status, '') not in ('trialing', 'active');

-- 3) Verify eligible firms (should return >= 1 row before worker send):
-- select id, firm_name, firm_code, subscription_status from public.firm_profiles
-- where subscription_status in ('trialing', 'active');

-- Optional: set a known beta firm code on your test firm account:
-- update public.firm_profiles set firm_code = 'BETA-FIRM01' where id = '<your-firm-profile-uuid>';
