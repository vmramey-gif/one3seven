-- TEMPORARY diagnostic RPC — introspect the live trigger/function state on public.profiles
-- to debug why the 20260812120000 privilege-lock fix did not engage as expected in a live
-- test. Will be dropped again by a follow-up migration once diagnosed.
create or replace function public.debug_profiles_trigger_state()
returns table(tgname text, tgtype smallint, tgenabled text, proname text, prosrc text)
language sql
security definer
set search_path = public
as $$
  select t.tgname, t.tgtype, t.tgenabled::text, p.proname, p.prosrc
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = 'public.profiles'::regclass
    and not t.tgisinternal;
$$;

grant execute on function public.debug_profiles_trigger_state() to authenticated, anon;
