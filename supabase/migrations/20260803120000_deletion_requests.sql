-- Worker-initiated account/data deletion requests (CCPA / CPRA §1798.105 — right to delete).
-- The worker files a verified request from Settings; it is recorded here and an admin fulfills the
-- permanent purge within the statutory window. Insert-only from the client; founders read to fulfill.

create table if not exists public.deletion_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users (id) on delete set null,
  email         text,
  requested_at  timestamptz not null default now(),
  status        text not null default 'pending',   -- pending | fulfilled | cancelled
  fulfilled_at  timestamptz
);

alter table public.deletion_requests enable row level security;

-- A signed-in worker may file their OWN request (insert only — no client read/update/delete).
drop policy if exists deletion_requests_insert_own on public.deletion_requests;
create policy deletion_requests_insert_own
  on public.deletion_requests
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Founders may read requests in order to fulfill them.
drop policy if exists deletion_requests_select_founder on public.deletion_requests;
create policy deletion_requests_select_founder
  on public.deletion_requests
  for select
  to authenticated
  using (public.is_founder());

-- Founders may mark a request fulfilled/cancelled after performing the purge.
drop policy if exists deletion_requests_update_founder on public.deletion_requests;
create policy deletion_requests_update_founder
  on public.deletion_requests
  for update
  to authenticated
  using (public.is_founder())
  with check (public.is_founder());
