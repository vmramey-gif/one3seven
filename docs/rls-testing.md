# RLS isolation testing

Worker records are **privileged material (Rule 1.6)**. One worker reading another worker's rows is
a malpractice-grade event, not a bug. Every worker-owned table has a Postgres Row-Level Security
(RLS) policy; this harness **proves those policies still hold after every change** and fails the
build the moment a single row crosses a user boundary.

## What it does

`scripts/rls-isolation-test.mjs` (run via `npm run test:rls`):

1. Creates two throwaway users **A** and **B** (service role).
2. Seeds each an `intakes` row + a child `timeline_events` row (service role, bypassing RLS).
3. Signs each user in to get an **RLS-subject client** (anon key + their JWT).
4. Asserts, for every table in the matrix:
   - each user **can** read their own rows (positive control — catches over-strict policies), and
   - each user reads **zero** of the other user's rows, both by direct id and in an unfiltered list.
5. Deletes all seeded rows and both users in `finally`.

Any breach → non-zero exit → red build.

## Running it

It needs a **non-production** Supabase project (staging or a throwaway test project — **never prod**).
The harness refuses to run against the known prod ref unless `RLS_TEST_ALLOW_PROD=1`.

```bash
export SUPABASE_TEST_URL="https://<staging-ref>.supabase.co"
export SUPABASE_TEST_ANON_KEY="<anon public key>"
export SUPABASE_TEST_SERVICE_ROLE_KEY="<service role key>"   # setup + teardown only
npm run test:rls
```

With no creds set it **skips** (exit 0) so local `npm test` and `npm run test:rls` are never blocked.

## CI

`.github/workflows/ci.yml` has an `rls-isolation` job. It self-skips (green) until you add three
repo secrets, then it enforces on every push/PR:

- `RLS_TEST_URL`
- `RLS_TEST_ANON_KEY`
- `RLS_TEST_SERVICE_ROLE_KEY`

Point them at a **staging project** whose schema mirrors prod (apply the same migrations there).
To make it blocking, require the `rls-isolation` check in branch protection on `main`.

## Coverage

| Table | Ownership | Notes |
|---|---|---|
| `intakes` | `worker_id = auth.uid()` | Ownership root |
| `timeline_events` | `intake_id → intakes.worker_id` | Child of intake |
| `intake_summaries` | `intake_id → intakes.worker_id` | **Also guards reminders, mitigation log, story follow-up, and the worker's name** — all stored as JSON blocks inside `overview` |
| `notifications` | `recipient_user_id = auth.uid()` | Self-owned |

**Intentionally not here:** `intake_routes` and `subscriptions` are worker↔**firm** / billing
boundaries, not worker↔worker. They're covered by the companion harness below.

## Firm-side companion: `scripts/rls-firm-isolation-test.mjs` (`npm run test:rls-firm`)

Closes the gap this file used to flag as not-yet-built. Same credentials, same guard pattern, same
CI job structure (`rls-firm-isolation` in `.github/workflows/ci.yml`). Proves:

1. **`intakes` is NEVER firm-readable, at any `route_status`.** `worker_metadata` (the worker's
   private narrative) must never reach a firm — not at `preview_sent`, not at `full_access`.
   Firms read case metadata through `firm_intake_preview` instead (a narrow view exposing only
   `id, intake_number, created_at, submission_channel, linked_firm_id, workflow_status`).
2. **Staged access**, using the real `worker_approve_full_access` RPC (not a service-role
   shortcut) to escalate — proving the actual production approval path, not just the policy:
   - At `preview_sent`: firm reads the preview view, reads zero of `uploaded_files` /
     `intake_summaries` / `timeline_events`.
   - At `full_access`: firm now reads all three; `intakes` itself is still zero.
3. **Firm↔firm cross-tenant isolation**, at both stages: a second firm with NO route to the
   intake reads zero of everything above.
4. **Regression checks**: a firm cannot self-escalate its own route to `full_access` via direct
   `UPDATE` (must go through the RPC), and cannot self-elevate its own `firm_profiles.plan_id`
   (legitimate self-edits like `firm_name` still work).

**Not covered by either harness:** `storage.objects` byte-level isolation needs real file uploads
to test end-to-end — verified today by static policy review instead (the `storage.objects` RLS
mirrors the same `route_status = 'full_access'` gate as `uploaded_files`). Add a real-upload test
here if this ever needs to be proven live rather than by policy inspection.

## Extending the matrix (do this as tables are added)

Add every new worker-owned table to **`CHILD_TABLES`** (owned via an intake) or **`SELF_TABLES`**
(owned via `user_id`) in the script. Provide how to seed a row and how a user-scoped client reads it
back; the generic loop adds the positive-control + cross-user assertions automatically. If a seed
fails on a NOT-NULL column, the run goes red with the exact column so you can fix the seed shape.
A worker table absent from both lists is an **untested boundary**.

## Why not pgTAP / local `supabase db reset`?

The base tables (`intakes`, `notifications`, …) are **not fully reproduced by the repo migrations**
(the schema has drifted from `supabase/migrations`). A local reset wouldn't build the real schema,
so the trustworthy target is a real staging DB with the true schema — which is what this harness
uses. (Reconciling migrations with the live schema is a separate, worthwhile cleanup.)
