-- TEMPORARY diagnostic RPC, dropped by the next migration once run — gets the exact trigger
-- binding (name, timing, event) for handle_new_user() on auth.users, confirmed live tonight to
-- be an undocumented hook (no tracked migration creates it — see roadmap item #3, schema drift).
-- Needed to write an accurate backfill migration that reconciles it into version control.
create or replace function public.debug_auth_users_trigger_binding()
returns table(tgname text, tgenabled text, timing text, events text, prosrc text)
language sql
security definer
set search_path = public
as $$
  select
    t.tgname::text,
    t.tgenabled::text,
    case when (t.tgtype::int & 2) = 2 then 'BEFORE' else 'AFTER' end,
    concat_ws(
      ',',
      case when (t.tgtype::int & 4) = 4 then 'INSERT' end,
      case when (t.tgtype::int & 8) = 8 then 'DELETE' end,
      case when (t.tgtype::int & 16) = 16 then 'UPDATE' end
    ),
    p.prosrc::text
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
  where t.tgrelid = 'auth.users'::regclass
    and not t.tgisinternal;
$$;

grant execute on function public.debug_auth_users_trigger_binding() to authenticated, anon;
