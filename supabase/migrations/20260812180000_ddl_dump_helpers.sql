-- TEMPORARY diagnostic RPCs (dropped by a follow-up migration once run) — generate the baseline
-- migration for the foundational tables discovered tonight to predate migration tracking
-- entirely (uploaded_files, intakes, profiles, firm_profiles, intake_routes, intake_summaries,
-- timeline_events, notifications — confirmed via a real replay-from-empty attempt against the
-- new staging project, per docs/one3seven-security-hardening-roadmap.md item #8's "recovery
-- proof" gate). Uses Postgres's OWN DDL-generating functions (pg_get_constraintdef,
-- pg_get_triggerdef, pg_get_functiondef, the pg_indexes/pg_policies views) rather than hand-
-- decoding raw catalog columns -- correctness comes from Postgres formatting its own DDL text,
-- not from me reconstructing type/constraint syntax by hand.

create or replace function public.dump_table_ddl(p_tables text[])
returns table(table_name text, ddl text)
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  col_lines text[];
  constraint_lines text[];
  index_lines text[];
  policy_lines text[];
  trigger_lines text[];
  rls_enabled boolean;
  body text;
  r record;
begin
  foreach t in array p_tables loop
    col_lines := array[]::text[];
    for r in
      select a.attname,
             format_type(a.atttypid, a.atttypmod) as typ,
             a.attnotnull,
             pg_get_expr(d.adbin, d.adrelid) as def
      from pg_attribute a
      left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
      where a.attrelid = ('public.' || t)::regclass
        and a.attnum > 0
        and not a.attisdropped
      order by a.attnum
    loop
      col_lines := array_append(col_lines,
        '  ' || quote_ident(r.attname) || ' ' || r.typ
        || case when r.attnotnull then ' not null' else '' end
        || case when r.def is not null then ' default ' || r.def else '' end);
    end loop;

    constraint_lines := array[]::text[];
    for r in
      select conname, pg_get_constraintdef(oid, true) as def
      from pg_constraint
      where conrelid = ('public.' || t)::regclass
    loop
      constraint_lines := array_append(constraint_lines,
        '  constraint ' || quote_ident(r.conname) || ' ' || r.def);
    end loop;

    body := 'create table if not exists public.' || quote_ident(t) || ' (' || E'\n'
      || array_to_string(col_lines || constraint_lines, ',' || E'\n')
      || E'\n);';

    index_lines := array[]::text[];
    for r in
      select indexdef from pg_indexes
      where schemaname = 'public' and tablename = t
        and indexname not in (
          select conname from pg_constraint
          where conrelid = ('public.' || t)::regclass and contype in ('p', 'u')
        )
    loop
      index_lines := array_append(index_lines, r.indexdef || ';');
    end loop;

    select relrowsecurity into rls_enabled from pg_class where oid = ('public.' || t)::regclass;

    policy_lines := array[]::text[];
    for r in
      select policyname, permissive, roles, cmd, qual, with_check
      from pg_policies where schemaname = 'public' and tablename = t
    loop
      policy_lines := array_append(policy_lines,
        'create policy ' || quote_ident(r.policyname) || ' on public.' || quote_ident(t)
        || ' as ' || lower(r.permissive)
        || ' for ' || r.cmd
        || ' to ' || array_to_string(r.roles, ', ')
        || case when r.qual is not null then ' using (' || r.qual || ')' else '' end
        || case when r.with_check is not null then ' with check (' || r.with_check || ')' else '' end
        || ';');
    end loop;

    trigger_lines := array[]::text[];
    for r in
      select pg_get_triggerdef(oid) || ';' as def
      from pg_trigger
      where tgrelid = ('public.' || t)::regclass and not tgisinternal
    loop
      trigger_lines := array_append(trigger_lines, r.def);
    end loop;

    table_name := t;
    ddl := body
      || E'\n\n' || array_to_string(index_lines, E'\n')
      || case when rls_enabled
           then E'\n\nalter table public.' || quote_ident(t) || ' enable row level security;'
           else '' end
      || E'\n' || array_to_string(policy_lines, E'\n')
      || E'\n' || array_to_string(trigger_lines, E'\n');
    return next;
  end loop;
end;
$$;

create or replace function public.dump_function_ddl(p_functions text[])
returns table(function_name text, ddl text)
language plpgsql
security definer
set search_path = public
as $$
declare
  f text;
begin
  foreach f in array p_functions loop
    function_name := f;
    select pg_get_functiondef(oid) || ';' into ddl
    from pg_proc
    where proname = f and pronamespace = 'public'::regnamespace
    limit 1;
    return next;
  end loop;
end;
$$;

grant execute on function public.dump_table_ddl(text[]) to authenticated, anon;
grant execute on function public.dump_function_ddl(text[]) to authenticated, anon;
