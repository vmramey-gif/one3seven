-- General "contact us" capture (worker flow, error screens, anywhere in-app).
-- Anyone (logged in or not) may submit; nobody may read via the API. The founder reads with
-- the service role (Supabase dashboard / SQL editor):
--   select * from public.contact_messages order by created_at desc;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text not null,
  message text not null,
  source text not null default 'app',
  path text,
  created_at timestamptz not null default now()
);

alter table public.contact_messages enable row level security;

-- Insert-only for anon + authenticated. No SELECT/UPDATE/DELETE policy → reads are restricted
-- to the service role (not exposed to the public API), mirroring pilot_interest.
drop policy if exists "contact_messages_insert_any" on public.contact_messages;
create policy "contact_messages_insert_any" on public.contact_messages
  for insert to anon, authenticated
  with check (true);

notify pgrst, 'reload schema';
