-- TEMPORARY, locked-down sweep (dropped by the next migration once run) — closes the remaining
-- uncertainty from tonight's secrets-hygiene finding: the exposed service_role key was found by
-- accident while dumping ONE table's DDL (profiles). This checks EVERY trigger and EVERY
-- SECURITY DEFINER function body across the whole public schema, not just the one that happened
-- to be looked at. Locked down from the start this time (revoke immediately after create, in the
-- same migration, not as an afterthought) — lesson learned from the earlier verification RPC
-- tonight that turned out to still be anon-callable despite a REVOKE FROM PUBLIC.
create or replace function public.sweep_all_trigger_and_function_defs()
returns table(kind text, name text, def text)
language sql
security invoker
set search_path = public
as $$
  select 'trigger'::text, t.tgname::text, pg_get_triggerdef(t.oid)
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and not t.tgisinternal
  union all
  select 'function'::text, p.proname::text, pg_get_functiondef(p.oid)
  from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.prosecdef = true;
$$;
revoke execute on function public.sweep_all_trigger_and_function_defs() from public, anon, authenticated;
