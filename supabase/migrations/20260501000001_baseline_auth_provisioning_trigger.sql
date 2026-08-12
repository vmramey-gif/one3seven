-- Companion to 20260501000000: the profiles auto-provisioning hook (backfilled into version
-- control on prod via 20260812170000, which staging's migration history was repaired past
-- without actually executing — `migration repair` records history without running SQL). This is
-- CONTENT-ONLY IDENTICAL to what 20260812170000 already establishes on prod (create or replace /
-- drop+create trigger — fully idempotent), so pushing this to prod is a no-op; pushing it to
-- staging actually creates it for the first time, which is required for the RLS isolation
-- harnesses to work at all (they create real auth users via the Admin API and expect a matching
-- profiles row to already exist before inserting into intakes, per the intakes_worker_id_fkey
-- foreign key — confirmed live: without this, harness seeding fails outright with a FK violation,
-- not a meaningful RLS test result).
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
