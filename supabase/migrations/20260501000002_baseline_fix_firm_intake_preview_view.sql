-- Fixes a real bug in this session's own reconstruction of firm_intake_preview (part of
-- 20260501000000's baseline) — that view was hand-assembled from a written description in
-- security_curriculum.md, not from Postgres's own pg_get_viewdef (the dump helper RPC was
-- already dropped by the time views were needed). Live-caught running the firm-side RLS harness
-- against staging for the first time ever: it expects a column named `id` matching intakes.id
-- (scripts/rls-firm-isolation-test.mjs:164, `.select('id, intake_number')`), but the
-- reconstruction aliased it to `intake_id` instead.
--
-- IMPORTANT: unlike `create table if not exists`, `create or replace view` is NOT a safe no-op
-- against an existing object — it unconditionally replaces the definition. Prod's real
-- firm_intake_preview view is correct (it was never actually touched; 20260501000000 was marked
-- applied on prod via `migration repair`, not executed) and must not be overwritten by this
-- guessed reconstruction. This migration is therefore repaired (marked applied, not executed) on
-- PROD, and pushed for real only on staging — see the deploy commands in
-- one3seven-security-hardening-roadmap.md's staging section. Do not `db push --linked` this
-- file normally.
-- CREATE OR REPLACE VIEW cannot rename an existing column (only append new ones) --
-- drop-and-recreate is required to fix the intake_id -> id column-name bug.
drop view if exists public.firm_intake_preview;
create view public.firm_intake_preview
with (security_invoker = off) as
select
  i.id,
  i.intake_number,
  i.workflow_status,
  i.status,
  i.submitted_at,
  r.firm_id,
  r.route_status
from public.intakes i
join public.intake_routes r on r.intake_id = i.id
where exists (
  select 1 from public.firm_profiles fp
  where fp.id = r.firm_id and fp.profile_id = auth.uid()
);
