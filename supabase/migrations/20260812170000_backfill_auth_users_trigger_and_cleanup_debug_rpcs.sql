-- Reconciles a real, live schema-drift instance into version control (roadmap item #3): the
-- `profiles` auto-provisioning hook, live in production but never created by any tracked
-- migration until this one. This is exactly the mechanism that made tonight's earlier debugging
-- confusing (a fresh signup already had a safe-default profiles row before the client's own
-- fallback insert ever ran, and nothing in git explained why). Confirmed via live introspection
-- 2026-08-12: trigger `on_auth_user_created`, AFTER INSERT on auth.users, calling
-- `handle_new_user()`, which does exactly `insert into public.profiles (id, email) values
-- (new.id, new.email) on conflict (id) do nothing` -- no privilege columns touched, so this is
-- fully compatible with and complementary to the INSERT-time privilege lock added by
-- 20260812120000 (that trigger still correctly floors is_founder/crm_role/approved to false
-- regardless of what this one inserts).
--
-- This migration is written to be a no-op against the live database (CREATE OR REPLACE / DROP+
-- CREATE TRIGGER against something that already exists in the exact same shape) -- it changes
-- nothing about behavior, it only makes the existing behavior replayable from an empty project,
-- which is the actual guarantee (see roadmap #8, "recovery proof").
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cleanup: remove the two temporary diagnostic RPCs added earlier tonight
-- (20260812150000, 20260812160000) now that both have been run and their results captured
-- above and in security_curriculum.md. Same "don't leave diagnostic scaffolding granted to
-- anon/authenticated in production" discipline as 20260812140000's cleanup of the first one.
drop function if exists public.audit_security_definer_functions();
drop function if exists public.debug_auth_users_trigger_binding();
