-- Attorney "request pilot access" capture for the For-law-firms page.
-- Anyone (including logged-out attorneys) may submit interest; nobody may read it via the
-- API. The founder reads submissions with the service role (Supabase dashboard / SQL editor):
--   select * from public.pilot_interest order by created_at desc;

create table if not exists public.pilot_interest (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  firm_name text,
  email text not null,
  note text,
  source text not null default 'forFirms',
  created_at timestamptz not null default now()
);

alter table public.pilot_interest enable row level security;

-- Insert-only for anon + authenticated. No SELECT/UPDATE/DELETE policy exists, so reads are
-- restricted to the service role (not exposed to the public API).
drop policy if exists "pilot_interest_insert_any" on public.pilot_interest;
create policy "pilot_interest_insert_any" on public.pilot_interest
  for insert to anon, authenticated
  with check (true);

notify pgrst, 'reload schema';
