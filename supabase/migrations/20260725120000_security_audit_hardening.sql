-- Security-audit hardening (2026-07-25).
--
-- ✅ VERIFIED 2026-07-25: production already enforces full-access-only firm reads via
-- `summary_firm_preview_or_full` / `timeline_firm_preview_or_full` (created with
-- `route_status = 'full_access'` by 20260618...). The loose `*_select_firm` policies targeted below
-- DO NOT EXIST in production, so the DROPs are a harmless no-op. Kept for repo/history consistency.
-- Finding #1 is CLOSED — no live hole. See docs/security-audit-2026-07.md.
--
-- FINDING #1 (HIGH): the 2026-06-18 "firm summary/timeline full-access-only" migration tried to
-- replace the loose firm-read policies but DROP-ed policy names that were never created
-- (`summary_firm_preview_or_full` / `timeline_firm_preview_or_full`). The actual permissive
-- policies from 2026-06-07 — `intake_summaries_select_firm` / `timeline_events_select_firm` — were
-- never removed. They grant a firm SELECT whenever ANY route to that firm exists, with NO
-- `route_status = 'full_access'` check. Postgres OR-combines permissive policies, so the loose
-- policy wins. Today all live routes are full_access, so it's masked — but the moment participating
-- PREVIEW routing ships, a preview-stage firm could read a worker's full summary/timeline.
--
-- This migration removes the loose policies. The strict `*_full_access_only` policies added in
-- 2026-06-18 remain and become the sole firm-read path.
--
-- ⚠ VERIFY AGAINST PRODUCTION FIRST — migration files and the live DB may have diverged. Run:
--     select policyname, cmd, qual from pg_policies
--     where tablename in ('intake_summaries','timeline_events') order by tablename, policyname;
--   Confirm the loose `*_select_firm` policies still exist (and that a strict full-access-only
--   policy is present to replace them) before/after applying. These DROPs are idempotent and safe
--   to run even if the policies were already removed manually.

drop policy if exists "intake_summaries_select_firm" on public.intake_summaries;
drop policy if exists "timeline_events_select_firm" on public.timeline_events;

-- FINDING #3 (LOW/MEDIUM) is intentionally NOT executed here: it would drop+recreate the worker
-- INSERT policy on the routes table to forbid a direct `full_access` grant (forcing it through the
-- route_intake_to_firm_code RPC, matching the existing UPDATE escalation guard). It only lets a
-- worker over-share THEIR OWN data to a firm of their choice (no cross-tenant read), so it is
-- deferred to avoid recreating a policy whose exact production definition can't be confirmed from
-- the repo. See docs/security-audit-2026-07.md for the recommended change + verification query.
