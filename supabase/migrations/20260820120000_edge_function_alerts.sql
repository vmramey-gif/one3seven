-- Durable alert log for edge-function external-call failures that would otherwise be lost.
--
-- Problem, found via a fresh reliability audit of all 12 edge functions (2026-08-20): two
-- background-triggered functions (stripe-webhook, notify-pilot-lead) can fail an external call
-- (Stripe→DB mapping miss, Resend send failure) with nobody watching. Both currently only
-- console.error, which is invisible unless someone happens to be reading Supabase function logs
-- at that exact moment. A user-initiated call (checkout, chat-assistant, worker emails) fails
-- loudly to a human who's right there and can retry -- that class is fine as-is. A
-- background-triggered call fails to nobody -- that's the class this closes.
--
-- Fix: any edge function that hits a "must-alert" failure writes one durable row here (via its
-- service-role client, which bypasses RLS) instead of relying solely on ephemeral function logs.
-- Founder-queryable via /hq; not exposed to any other role.

create table if not exists public.edge_function_alerts (
  id            uuid primary key default gen_random_uuid(),
  function_name text not null,
  alert_type    text not null,
  detail        jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists edge_function_alerts_created_at_idx on public.edge_function_alerts (created_at desc);
create index if not exists edge_function_alerts_function_name_idx on public.edge_function_alerts (function_name, created_at desc);

alter table public.edge_function_alerts enable row level security;

-- No insert policy for `authenticated` at all -- rows are written exclusively by edge functions
-- using the service-role client, which bypasses RLS. This blocks a client from ever writing (or
-- forging) an alert row.
drop policy if exists edge_function_alerts_select_founder on public.edge_function_alerts;
create policy edge_function_alerts_select_founder
  on public.edge_function_alerts
  for select
  to authenticated
  using (public.is_founder());

-- No update/delete policy for any role -- RLS enabled + zero permissive policies for those
-- commands means UPDATE and DELETE are refused outright, including for founders. Alerts are
-- meant to be a permanent record of what happened, not a to-do list that gets edited in place.

notify pgrst, 'reload schema';
