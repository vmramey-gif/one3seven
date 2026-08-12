-- TEMPORARY diagnostic RPC (same pattern as 20260812130000, dropped again by a follow-up
-- migration once run) — closes roadmap item #7 (docs/one3seven-security-hardening-roadmap.md):
-- a catalog-level audit of EVERY SECURITY DEFINER function in the live database, not just the
-- two (profiles/firm_profiles) already found and fixed tonight. The text-scan CI check
-- (scripts/check-security-definer-current-user.mjs) only sees tracked migration files; this
-- sees what's actually installed, including anything created outside a migration.
create or replace function public.audit_security_definer_functions()
returns table(
  schema_name text,
  function_name text,
  owner_role text,
  execute_granted_to_public boolean,
  search_path_set boolean,
  references_current_user_or_role boolean,
  prosrc text
)
language sql
security definer
set search_path = public
as $$
  select
    n.nspname::text,
    p.proname::text,
    pg_get_userbyid(p.proowner)::text,
    -- 'public' is not a real role name -- has_function_privilege('public', ...) would silently
    -- check a nonexistent role. The PUBLIC pseudo-grantee is represented by ACL grantee OID 0;
    -- aclexplode() over the function's actual ACL (or the type's default ACL when proacl is
    -- null, since Postgres grants EXECUTE to PUBLIC by default unless explicitly revoked) is the
    -- correct check. Caught and fixed before this ever ran, not after.
    exists (
      select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ),
    p.proconfig is not null and exists (
      select 1 from unnest(p.proconfig) c where c like 'search_path=%'
    ),
    p.prosrc ~* '\mcurrent_user\M|\mcurrent_role\M',
    p.prosrc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where p.prosecdef = true
    and n.nspname not in ('pg_catalog', 'information_schema')
  order by n.nspname, p.proname;
$$;

grant execute on function public.audit_security_definer_functions() to authenticated, anon;
