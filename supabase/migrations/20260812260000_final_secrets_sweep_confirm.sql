-- TEMPORARY, locked-down (dropped by the next migration) — final confirmation pass after
-- dropping both exposed-secret triggers, proving zero remain rather than assuming.
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
