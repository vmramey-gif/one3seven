-- Prevent firms from self-escalating route_status to full_access via direct API update.
--
-- Root cause: routes_firm_update had no WITH CHECK clause, allowing a firm to
-- UPDATE their own route row to any route_status including full_access, bypassing
-- the worker approval gate.
--
-- Fix: add WITH CHECK (route_status <> 'full_access').
--
-- Legitimate firm state changes (preview_sent → access_requested, → declined) are
-- still permitted. The worker_approve_full_access and route_intake_to_firm_code RPCs
-- run as SECURITY DEFINER and bypass RLS, so they are unaffected.

-- firm_intake_routes is a VIEW of intake_routes in production.
-- The RLS policy lives on the underlying table: intake_routes.

drop policy if exists "intake_routes_update_parties" on public.intake_routes;

create policy "intake_routes_update_parties" on public.intake_routes
  for update
  using (
    exists (select 1 from public.intakes i where i.id = intake_id and i.worker_id = auth.uid())
    or exists (select 1 from public.firm_profiles fp where fp.id = firm_id and fp.profile_id = auth.uid())
  )
  with check (
    -- Workers may set any status (their approval is the legitimate path to full_access).
    -- Firms may not set full_access directly — must go through worker_approve_full_access RPC.
    exists (select 1 from public.intakes i where i.id = intake_id and i.worker_id = auth.uid())
    or route_status <> 'full_access'
  );
