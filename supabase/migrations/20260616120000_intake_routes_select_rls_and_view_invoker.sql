-- Close cross-firm route-metadata read exposure.
--
-- Problem: firm_intake_routes is a plain pass-through VIEW of intake_routes
-- (SELECT ... FROM intake_routes, no WHERE) created WITHOUT security_invoker.
-- It therefore runs with the view owner's rights and BYPASSES intake_routes RLS.
-- The firm dashboard's only scoping was the client-side `.eq('firm_id', …)`,
-- which is not a security boundary — an authenticated firm could read any other
-- firm's route rows (intake_id, firm_id, route_status, timestamps) by querying a
-- different firm_id. (Worker document/summary/timeline content was NOT exposed —
-- those tables have their own firm-scoped SELECT policies.)
--
-- Fix: enforce firm/worker scoping on intake_routes itself, and make the view
-- respect the querying user's RLS (security_invoker) so reads through the view
-- are filtered by the same policy.
--
-- NOTE: verify `select policyname, cmd, qual from pg_policies where tablename =
-- 'intake_routes';` first. If a broader/permissive SELECT policy exists (e.g.
-- `using (true)`), it must be dropped too — Postgres OR-combines permissive
-- policies, so a permissive one would override the scoped policy below. Add a
-- matching `drop policy if exists <name> on public.intake_routes;` here if so.

alter table public.intake_routes enable row level security;

drop policy if exists intake_routes_select_parties on public.intake_routes;

create policy intake_routes_select_parties on public.intake_routes
  for select
  using (
    -- Worker who owns the intake
    exists (
      select 1 from public.intakes i
      where i.id = intake_id and i.worker_id = auth.uid()
    )
    -- Firm that owns the firm_profile this route points to
    or exists (
      select 1 from public.firm_profiles fp
      where fp.id = firm_id and fp.profile_id = auth.uid()
    )
  );

-- Make the pass-through view enforce the caller's RLS instead of the owner's.
-- (Supabase Postgres is 15+, which supports security_invoker on views.)
alter view public.firm_intake_routes set (security_invoker = on);
