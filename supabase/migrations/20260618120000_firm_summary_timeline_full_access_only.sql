-- Tighten firm read access on intake_summaries and timeline_events to full_access only.
--
-- Why: the prior policies (summary_firm_preview_or_full / timeline_firm_preview_or_full)
-- granted a firm SELECT on the summary + timeline rows whenever ANY route existed —
-- including preview_sent. The app layer redacts preview content, but RLS permitted a
-- firm to read the raw rows directly via the API, bypassing that redaction. For a legal
-- product holding employment records, firm read access should be RLS-enforced, not just
-- app-enforced. This matches the existing uploaded_files / storage policies, which already
-- require route_status = 'full_access'.
--
-- Safe to apply now: participating-preview routing is gated off in the client
-- (PARTICIPATING_ROUTING_LIVE = false); the only live routes are firm-code, which are
-- created at 'full_access'. This change only NARROWS firm read access to intakes that
-- reached full access — the legitimate review state.
--
-- Future note: when participating preview is built for real, give it a purpose-built,
-- contact-free preview projection rather than re-widening these policies.

drop policy if exists "summary_firm_preview_or_full" on public.intake_summaries;
create policy "summary_firm_preview_or_full" on public.intake_summaries for select using (
  exists (
    select 1
    from public.firm_intake_routes r
    join public.firm_profiles fp on fp.id = r.firm_id
    where r.intake_id = intake_summaries.intake_id
      and fp.profile_id = auth.uid()
      and r.route_status = 'full_access'
  )
);

drop policy if exists "timeline_firm_preview_or_full" on public.timeline_events;
create policy "timeline_firm_preview_or_full" on public.timeline_events for select using (
  exists (
    select 1
    from public.firm_intake_routes r
    join public.firm_profiles fp on fp.id = r.firm_id
    where r.intake_id = timeline_events.intake_id
      and fp.profile_id = auth.uid()
      and r.route_status = 'full_access'
  )
);
