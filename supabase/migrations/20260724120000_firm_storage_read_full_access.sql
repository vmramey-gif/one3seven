-- Grant firm users READ (select) on storage objects for intakes they have FULL access to.
--
-- Why: the source-linked citation panel (firm intake review) can read the extracted data from the
-- database but not the underlying PDF bytes in storage, so createSignedUrl() returns "Object not
-- found" — which is how Supabase MASKS an RLS denial on storage.objects. Files live at
-- {workerId}/{intakeId}/{file} in the 'intake-files' bucket, so the intake id is folder segment [2].
--
-- This mirrors the existing full-access predicate already used on intake_summaries / timeline_events
-- (see 20260618120000_firm_summary_timeline_full_access_only.sql): firm_intake_routes joined to
-- firm_profiles, scoped to the calling firm (fp.profile_id = auth.uid()) and route_status =
-- 'full_access'. Compared as text (r.intake_id::text = segment) to avoid a uuid cast on untrusted
-- path text.
--
-- Additive & safe: RLS policies are OR-combined, so this does NOT change the worker-owner read
-- policy (workers keep access to their own {workerId}/... objects). Preview-only firms get nothing
-- (the predicate requires full_access). A firm on intake A cannot read intake B's files (the path
-- segment is matched against that firm's own full-access routes).

drop policy if exists "intake_files_firm_full_access_read" on storage.objects;

create policy "intake_files_firm_full_access_read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'intake-files'
  and exists (
    select 1
    from public.firm_intake_routes r
    join public.firm_profiles fp on fp.id = r.firm_id
    where r.intake_id::text = (storage.foldername(name))[2]
      and fp.profile_id = auth.uid()
      and r.route_status = 'full_access'
  )
);
