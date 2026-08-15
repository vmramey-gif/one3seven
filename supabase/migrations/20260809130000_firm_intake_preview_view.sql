-- Safe, narrow replacement for the direct `intakes` read the firm dashboard needs at ANY
-- route stage (including before full access) — case number, submission date, status. Exposes
-- ONLY those columns, never worker_metadata or anything else on `intakes`.
--
-- security_invoker is deliberately OFF here (unlike firm_intake_routes, which was fixed to be ON
-- in 20260616120000 because it was a plain pass-through that needed to inherit the base table's
-- RLS). This view is the opposite case: intentional, controlled relaxation. Its own WHERE clause
-- fully implements the correct authorization check (any route belonging to the calling firm), and
-- the projection contains zero sensitive columns, so running with the view owner's rights to reach
-- past the now-firm-restricted `intakes` policy is safe by construction, not an oversight.
--
-- 2026-08-15: was `create or replace view`, which is not safely replayable from an empty
-- database. The preceding migration in this chain, 20260501000002, leaves the view as
-- (id, intake_number, workflow_status, status, submitted_at, firm_id, route_status) --
-- column 3 there is workflow_status, but here it's created_at, and CREATE OR REPLACE VIEW
-- can only append columns, never rename/reorder existing ones (SQLSTATE 42P16, confirmed live
-- attempting a from-scratch replay against a rebuilt staging project). 20260501000002's own
-- comment already documented this exact constraint for the SAME view one migration earlier;
-- this file just didn't apply it. Switched to drop-and-recreate, which has no such restriction.
-- Confirmed via a live `pg_get_viewdef` read against prod that this is (and remains) prod's
-- real, current definition -- this change is a no-op wherever it already ran (prod, staging),
-- and only changes behavior for a genuine from-scratch replay.
drop view if exists public.firm_intake_preview;
create view public.firm_intake_preview as
select i.id, i.intake_number, i.created_at, i.submission_channel, i.linked_firm_id, i.workflow_status
from public.intakes i
where exists (
  select 1
  from public.intake_routes ir
  join public.firm_profiles fp on fp.id = ir.firm_id
  where ir.intake_id = i.id
    and fp.profile_id = auth.uid()
);

alter view public.firm_intake_preview set (security_invoker = off);

grant select on public.firm_intake_preview to authenticated;
