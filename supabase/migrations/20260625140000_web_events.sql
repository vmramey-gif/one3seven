-- First-party, cookieless funnel analytics. No PII: event names + path/referrer/session only.
-- Owned in our own DB (no third-party tracker touching prospect behavior). Founder reads the funnel.

create table if not exists public.web_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  event       text not null,
  path        text,
  referrer    text,
  session_id  text,
  props       jsonb
);

alter table public.web_events enable row level security;

-- Anyone (incl. anonymous visitors) may log an event — it's append-only telemetry, no PII.
drop policy if exists "web_events_insert_any" on public.web_events;
create policy "web_events_insert_any" on public.web_events
  for insert to anon, authenticated
  with check (true);

-- Only the founder can read the funnel.
drop policy if exists "web_events_select_founder" on public.web_events;
create policy "web_events_select_founder" on public.web_events
  for select to authenticated
  using (public.is_founder());

create index if not exists web_events_event_created_idx on public.web_events (event, created_at desc);
