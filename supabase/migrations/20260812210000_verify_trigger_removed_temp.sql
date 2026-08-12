-- TEMPORARY, locked-down verification (dropped by the next migration). Unlike the earlier
-- diagnostic RPCs tonight, explicitly REVOKE EXECUTE FROM PUBLIC immediately after creation --
-- Postgres grants EXECUTE to PUBLIC by default on every new function unless revoked, which is
-- exactly the gap that made the previous RPC anon-callable. service_role can still call it (it
-- owns the function via the migration-runner role), nobody else can.
create or replace function public.verify_public_profiles_trigger_gone()
returns boolean
language sql
security invoker
set search_path = public
as $$
  select not exists (
    select 1 from pg_trigger
    where tgname = 'public_profiles' and tgrelid = 'public.profiles'::regclass
  );
$$;
revoke execute on function public.verify_public_profiles_trigger_gone() from public;
