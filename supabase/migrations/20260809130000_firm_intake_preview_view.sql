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

create or replace view public.firm_intake_preview as
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
