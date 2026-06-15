-- Demo NDA log: records who accepted the confidentiality gate before the public demo.
-- Rows are insert-only (no updates, no deletes by default).
-- Accessible via service role for reporting; anon/authenticated can INSERT only.

create table if not exists public.demo_nda_log (
  id           uuid primary key default gen_random_uuid(),
  full_name    text not null,
  email        text not null,
  accepted_at  timestamptz not null default now(),
  source       text not null default 'demo_link',
  ip_hint      text,         -- optional: populated server-side if needed later
  created_at   timestamptz not null default now()
);

-- Index for email lookups / deduplication reporting
create index if not exists demo_nda_log_email_idx on public.demo_nda_log (email);

-- RLS: anyone (including anon) can insert their own acceptance row.
-- No reads via client — reporting is service-role only.
alter table public.demo_nda_log enable row level security;

create policy "Anyone can log NDA acceptance"
  on public.demo_nda_log
  for insert
  with check (true);

-- No select/update/delete policies — data is write-only from the client.
