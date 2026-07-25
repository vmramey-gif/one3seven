# Firm storage-read policy for source-linked citations (OPERATOR / backend)

## Problem
The on-screen "clickable extraction quote" feature (firm intake review) opens the source panel and
finds the right quote, but the PDF never loads. `createSignedUrl` on the file returns **"Object not
found"** — which is how Supabase **masks an RLS denial** on storage objects.

Root cause: a **firm** account has no `SELECT` policy on `storage.objects` for a **worker's** uploaded
file. The extracted text/quotes come from the database (which the firm can read on a full-access
intake); the PDF bytes live in the `intake-files` bucket behind a separate lock that only grants the
owner (the worker). This was never noticed before because the only other on-screen citation surface
(wage exposure) is counsel-gated/off, so the storage path was never exercised.

The **client is correct** — do not patch it. This is a storage RLS policy the operator must apply.

## Facts the policy needs
- Bucket: `intake-files`
- Object path shape: `{workerId}/{intakeId}/{timestamp}_{filename}.pdf`
  → `intakeId = (storage.foldername(name))[2]` (Postgres arrays are 1-indexed; `[1]`=workerId)
- Firm access is recorded in **`firm_intake_routes`**: columns `intake_id`, `firm_id`, `route_status`.
  Full access = `route_status = 'full_access'`.
- The current firm user's `firm_id` must be resolved from `auth.uid()` — via whatever maps an auth
  user to a firm (e.g. `firm_profiles.id`/`user_id`, or a membership table). **Fill this in to match
  the real schema** — it is the one piece this template can't assume.

## FINALIZED policy (schema-verified — ready to run)

Written as migration `supabase/migrations/20260724120000_firm_storage_read_full_access.sql`. It uses
the SAME full-access predicate already in production on intake_summaries / timeline_events
(`firm_intake_routes` join `firm_profiles`, `fp.profile_id = auth.uid()`, `route_status='full_access'`).

```sql
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
```

## How to apply (operator)

Storage RLS policies are reliably applied as the owner role, so the Supabase **SQL Editor** is the
simplest path:

1. Supabase dashboard → **SQL Editor** → paste the block above → **Run**.
   (Or, if using the CLI with migrations wired up: `npx supabase db push`.)
2. No app deploy needed — it's a database policy; the client already does the right thing.

## Verify after applying
1. As the firm user on a full-access intake, click a quote → the PDF should render and jump to the line.
2. As a firm user on a PREVIEW-only intake, the quote panel must still fall back gracefully (no access)
   — confirm the policy does NOT grant preview firms read (it checks `route_status = 'full_access'`).
3. Confirm a firm on intake A cannot sign a file from intake B (path-parsed intakeId scoping).

## After it works
Remove the temporary `loadError` "Debug:" line from `CitationPanel` / `IntakeReviewScreen`
(added only to diagnose this).

## Note
The **worker side is not blocked** — the worker owns their files (owner RLS on `{workerId}/...`), so
worker-side clickable sources work without any new policy.
