# one3seven — Data Architecture

> **Rewritten 2026-08-20.** The previous version of this document described an in-memory,
> `useState`-only prototype with no backend — that architecture no longer exists and hasn't for
> some time. This version describes what's actually in the codebase today, verified by reading
> the real code (import graphs, actual callers, actual RLS policies), not recalled from an earlier
> design doc. If a claim here stops matching the code, trust the code and fix this file, not the
> other way around.

## The real architecture, in one paragraph

Supabase is the backend: Postgres tables with row-level security, real Auth (email/password,
persisted sessions), Storage for uploaded files, and Deno edge functions for anything that needs a
server-side secret (Claude API calls, Stripe, Resend, Twilio). The client is a React/Vite SPA
(`src/app/`) that talks to Supabase directly via `src/lib/supabaseClient.ts` for most reads/writes,
and to edge functions (`supabase/functions/*`, deployed separately from the frontend — see
`reference_supabase_deploy` memory) for anything secret-gated. `src/services/intakeDataService.ts`
is the central data-access layer nearly everything routes through for worker/firm data.

## Where an intake's data actually lives

- **`intakes`** — one row per case a worker started. Owns the worker relationship (`worker_id`),
  category, and workflow status.
- **`uploaded_files`** — one row per uploaded document (Storage path, filename, category,
  content-hash for dedup).
- **`file_text_extractions`** — Phase 2A (plain-text extraction, no AI) and the AI-extracted
  `document_facts` JSON per file, written by the `extract-document-facts` edge function.
- **`intake_summaries`** — the organized output: the generated narrative, timeline, categories. See
  "The sidecar-JSON convention" below — this table's `overview` text column carries far more
  structured state than its name suggests.
- **`intake_routes`** — a worker's connection to a specific firm (firm-code routing) and its access
  level (`preview`, `full_access`, etc.), immutably audited by a trigger into
  `intake_route_events` (see `project_liability_audit_aug2026` memory).
- **`firm_profiles`**, **`profiles`** — firm and user accounts. `profiles.role` (`'worker'` |
  `'firm'`) drives which UI a signed-in user sees; it cannot be self-set to `'firm'` by a client
  (see Auth below).

Nearly every read/write to these tables goes through named functions in `intakeDataService.ts`
(e.g. `persistPlaceholderOrganizationForIntake`, `loadFirmLiveIntakeView`,
`listFirmAccessibleUploadInventory`) rather than ad hoc `.from(...)` calls scattered across
screens — that file is the thing to open first to understand how a given piece of data actually
gets read or written.

## The sidecar-JSON convention (the single most important thing to know before touching `overview`)

`intake_summaries.overview` is a free-text column, but in practice it also carries **several
independent pieces of structured state**, each encoded as a JSON blob wrapped in a distinct
`--- O3S_<NAME> --- ... --- O3S_<NAME>_END ---` delimiter and concatenated into the same text
field. This is a deliberate, migration-free way to add a new persisted field without a schema
change — and it works, consistently, across the whole codebase — but it means **`overview` is not
just prose**, and any code that reads or rewrites it needs to know these blocks exist or it will
silently corrupt one.

Known blocks, each with its own dedicated encode/decode module:

| Block | Carries | Module |
|---|---|---|
| `O3S_ORG_ENGINE` | file records + timeline + sections (the organization engine's own output) | `intakeOrgEngineCodec.ts` |
| `O3S_SOURCE_TRACE` / `O3S_RECORD_STORY` / `O3S_FIRM_REVIEW_SUMMARY` | source citations, per-record story, firm-facing summary | `timelineSourceTraceCodec.ts` |
| `O3S_STORY_FOLLOWUP` | guided-intake follow-up answers (employer, dates, key people, remote-work/arbitration) | `storyFollowUpPersistence.ts` |
| `O3S_MITIGATION_LOG` | worker-owned job-search log entries | `mitigationLog.ts` |
| (reminders block) | worker/firm-set reminder dates, `.ics`-exportable | `workerReminders.ts` |
| (contact block) | worker name/phone, copied in only at the consent moment a worker shares with a firm | `workerContactPersistence.ts` |
| `O3S_EMPLOYMENT_MATTER` | selected employment-matter tags | `employmentMatterPersistence.ts` (this one also duplicates to `localStorage`) |

**If you're writing new code that touches `overview`:** always go through the relevant
`merge*IntoLatestIntakeSummary()` / `extract*FromOverview()` pair rather than reading or
overwriting the raw string. A naive `overview = newText` will silently delete every other worker's
block that happened to be encoded in the same field. This exact class of bug has caused real data
loss before (see `project_extraction_accuracy` memory, the 2026-08-05 notes-loss incident) — it's
the reason this table of blocks exists in this document at all.

## The legacy `IntakeWorkspace` layer — mostly superseded, partially still live

`src/app/types/IntakeWorkspace.ts` predates the Supabase migration. It defines an in-memory
`IntakeWorkspace` object tracked in `App.tsx`'s own `useState`, with helper functions to update it.
**Do not treat this as the current architecture** — but it isn't fully dead either, which is worth
being precise about rather than assuming either way:

- `App.tsx` still keeps a live `currentIntakeWorkspace` in state, updated via
  `createEmptyIntakeWorkspace()` / `updateIntakeWorkspace()` / `markIntakeAsSaved()`, and passes it
  down as a prop to `IntakeSummaryScreen` and `IntakeReviewScreen`.
- Both of those screens read from it, but **only as a fallback** behind the real Supabase-backed
  data — e.g. `IntakeSummaryScreen.tsx`: `liveOverview ?? intakeWorkspace.intakeSummary?.overview`.
  If the real (Supabase) data is present, the workspace object is never consulted.
- `IntakeReviewScreen` also still calls `updateWorkflowStatus()` from this file.
- Several other exported functions on this file (`getEligibleFirms`, `submitIntakeToFirms`,
  `addInternalReviewerNote`, `requestAdditionalInfo`, `routeIntakeToFirms`) have **zero callers
  anywhere in the codebase** — confirmed by grep, not assumed — and were removed 2026-08-20.
  `getEligibleFirms` in particular was a stub that claimed to route by geography/category/
  readiness but just returned every firm ID unconditionally; since nothing called it, that was
  dead code rather than a live bug, but a genuinely misleading one to leave sitting there.

**Bottom line:** treat `IntakeWorkspace` as a thin, mostly-inert fallback layer clinging to two
screens, not as the source of truth. The source of truth is Supabase, reached through
`intakeDataService.ts`.

## Firm access and routing (how it actually works today)

There is no dynamic "eligible firms" matching engine (the pre-Supabase `getEligibleFirms` stub
never did this, and nothing replaced it). Firm access today is one of:

1. **Firm-code routing** — a worker enters a specific firm's code, creating an `intake_routes` row
   at `preview` or (after the firm requests and the worker approves) `full_access`. Currently
   gated off for *new* connections (`FIRM_CODE_ROUTING_LIVE = false` in `constants/flags.ts`,
   funding/counsel pause — see `project_strategy_pause_attorney_push_worker` memory); existing
   connections and the *remove* path still work.
2. **Worker-initiated email** — a worker emails their organized PDF directly to any firm's inbox
   via the `send-intake-to-firm-email` edge function. No firm account or one3seven relationship
   required on the receiving end. This is the live, unblocked path.

Firm accounts themselves are **founder-provisioned only** — a DB trigger
(`enforce_profile_privilege_lock`, migration `20260817220000`) rejects any user-initiated attempt
to set `profiles.role = 'firm'`. There is no self-serve firm signup, and no public checkout page
that doesn't already require an existing firm profile.

## Privacy boundaries (verified against real RLS, not just app-level checks)

- A firm can only read an intake's `intake_summaries`/uploaded files once its `intake_routes` row
  reaches `full_access` — enforced at the RLS policy level, not just hidden in the UI.
- A `preview`-level route strips the worker's narrative/notes before the firm ever sees it
  (`stripWorkerFollowUpNarrativeForPreview` and friends) — this used to be a client-side-only
  strip (a real, since-closed leak, see `project_worker_surface_audit_aug2026` memory); confirm
  current RLS coverage before assuming a field is safe just because the UI hides it.
- `intake_route_events` is an append-only audit trail of every access grant/revoke — no update or
  delete policy exists for any role, including the founder.

## Where to look next

- `src/services/` — the actual business logic (extraction, timeline/claim-lens engines, PDF
  rendering, billing). See the codebase-wide inventory from the 2026-08-20 session if it still
  exists, or re-derive it — it isn't checked into the repo as a file.
- `supabase/functions/` — every server-side/secret-gated operation, one directory per function.
- `supabase/migrations/` — the real schema and RLS history, in order. When in doubt about what a
  table's policies actually allow, read the migration, don't guess from the app code.
