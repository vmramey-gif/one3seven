# one3seven — Engineer Review Packet

Everything a reviewer needs to run, understand, and independently evaluate this codebase, written for
someone seeing it for the first time. It frames context and points to evidence; all judgments are yours.

## 1. What it is
A California plaintiff-employment **intake-organization** web app. A worker uploads scattered employment
records; AI organizes them into a **source-linked** timeline/packet for an attorney to review. Core product
rule (enforced in code): it **organizes and reflects — it never concludes, advises, scores, or predicts.**
Firms are the phase-1 distribution channel.

**Stack:** React 18.3 · Vite 6.3 · TypeScript 5.6 · Tailwind 4.1 · motion 12 · Supabase (Postgres + RLS +
Deno Edge Functions) · Anthropic Claude API · pdf-lib / pdfjs-dist (packet PDF). Vitest for tests.

**Size:** ~272 TS/TSX files · 39 screens · 44 SQL migrations · 7 edge functions · 43 test files (255 tests).

---

## 2. Prerequisites
- **Node 20+** (developed on 20–24) and npm.
- That is sufficient for the credential-free **Level A** review below. A full connected environment
  (Level B/C) requires the services and credentials described in those sections.

## 3. Run it — three levels

### Level A — UI review, NO secrets (start here)
Browse the whole UI without any credentials.
```bash
npm i
printf 'VITE_SHOW_DEV_GALLERY=true\n' > .env
npm run dev
```
- With Supabase env unset, the app shows a **dev screen gallery** (UI previews only; no fake sign-in).
- Visit **`/demo`** — the firm intake packet rendered from a built-in sample (Marcus Rivera fixture), no login.
- Visit `/`, `/for-firms`, `/terms`, `/privacy` — public marketing + legal pages.
- Note: the demo runs the **same production code**, just against an in-memory fixture instead of the DB.

### Level B — Full app with real data (reproducible fresh setup)
Needs a Supabase project. To stand one up from scratch:
1. **Extensions:** ensure `pgcrypto` is enabled (used by the schema).
2. **Schema first:** run `supabase/schema.sql` — this is the **authoritative baseline** (core tables:
   `intakes`, `uploaded_files`, `intake_summaries`, `timeline_events`, `firm_intake_routes`, plus triggers
   and the RLS policies). Migrations assume these already exist (the earliest migration *alters*
   `uploaded_files`), so schema.sql is not optional.
3. **Then migrations:** apply `supabase/migrations/*.sql` **in filename (timestamp) order** — they are
   incremental additions (file-text extractions, CRM, pilot interest, web events, etc.).
4. **Storage:** create a storage bucket named **`intake-files`** (uploaded documents live here).
5. **Auth:** set the site URL / redirect URLs for your Supabase project (magic-link / password reset).
6. **No seed data ships** — use the app to create a worker + intake, or review via `/demo` (Level A).
7. Frontend env:
   ```bash
   # .env
   VITE_SUPABASE_URL=<supabase project url>
   VITE_SUPABASE_ANON_KEY=<supabase anon key>   # anon key is public/client-side by design
   ```
Then `npm run dev`. Now auth, worker intake, firm dashboard, and `/hq` (internal CRM) work against the DB.
> If any step above is ambiguous for your Supabase tooling, ask the founder — the canonical source of truth
> is `schema.sql` (baseline) + migrations (in order); there is no one-command bootstrap script yet.

### Level C — Edge functions (optional, advanced)
`supabase/functions/*` are Deno functions: `chat-assistant`, `extract-document-facts`,
`get-intake-intelligence`, `stripe-webhook`, `create-checkout-session`, `create-portal-session`,
`notify-pilot-lead`. They read secrets from the Supabase project env: `ANTHROPIC_API_KEY`,
`SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY`, `STRIPE_*`, `RESEND_API_KEY`, `PILOT_*`, `APP_URL`.
**Never commit these.** Deploy: `npx supabase functions deploy <name>`.

## 4. Commands
| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build (esbuild — does NOT typecheck) |
| `npm test` | Vitest — **255 tests** pass |
| `npm run typecheck` | `tsc --noEmit` — currently exits with errors (see §7 / §7b) |

---

## 5. Architecture map (where things live)
- **`src/main.tsx`** — entry + path-based routing (`/`, `/for-firms`, `/demo`, `/worker-demo`, `/terms`,
  `/privacy`, `/hq`, `/company-demo`, `/fire-demo`). Read first.
- **`src/app/App.tsx`** — main app state machine (screen routing, auth flow, worker/firm flows). Large;
  see §10.
- **`src/app/screens/`** (39) — `SageMarketingPage` (home), `ForFirmsPage`, `UploadScreen` (worker intake),
  `IntakeReviewScreen` (firm packet view), `FounderCRMScreen`/`FounderHQ` (internal CRM), `DemoApp` (fixture demo).
- **`src/services/`** — business logic: `firmIntakeSummaryDownload.ts` + `firmIntakePdfRenderer.ts` (packet),
  `damagesCalculator.ts` / `damagesAssembly.ts` / `wageRules.ts` (wage arithmetic — see §6c),
  `intakeDataService.ts` (data access), `bannedVocabulary.ts` (UPL word-blocking).
- **`src/i18n/i18n.tsx`** — EN/ES string dictionary.
- **`supabase/schema.sql` + `supabase/migrations/`** (44) — data model + RLS.
- **`supabase/functions/`** (7) — Deno edge functions incl. the AI.

## 6. Data & authorization flow (how the system behaves)
```text
Worker browser
  → Supabase Auth (email/password or magic link)
  → creates `intakes` + `uploaded_files` rows under worker-scoped RLS (auth.uid() = worker_id)
  → uploads document bytes to the `intake-files` storage bucket
  → authenticated edge function `extract-document-facts` (server-side, service-role)
        → sends document text to the Anthropic API for extraction
        → persists structured facts / timeline (`intake_summaries`, `timeline_events`)
  → worker EXPLICITLY shares with a firm → a `firm_intake_routes` row is created (the authorization gate)
  → firm user (separate account) sees the intake ONLY via that route (RLS join on firm_intake_routes)
  → firm review UI (`IntakeReviewScreen`)
  → packet PDF assembled client-side (pdf-lib) for download
```
The **authorization pivot is `firm_intake_routes`**: no firm sees any intake until a route row exists, and
routes are created by the worker's sharing action. That table is the thing to scrutinize.

### 6b. Security — the questions to try to break
RLS is the isolation model (`supabase/schema.sql`, ~line 120+). A security reviewer should attempt:
- Can one worker read another worker's intake by changing an ID in a query? (RLS should block.)
- Can a firm create or modify its **own** `firm_intake_routes` entry (self-granting access)?
- Which actor is authorized to establish the worker→firm route — and is it enforced server-side?
- Are **storage-object** policies on `intake-files` aligned with the DB row policies (or is storage a gap)?
- Does every service-role edge function independently verify the caller's identity?
- Can the client supply `worker_id` / `firm_id` / owner values that should be derived server-side?
- On deletion, are the underlying **storage files** removed, not just the DB rows?
- Are AI inputs/outputs logged anywhere, and is any raw model output returned without schema validation?

### 6c. The wage-exposure feature (read before judging the "never conclude" claim)
`damagesCalculator.ts` / `damagesAssembly.ts` / `wageRules.ts` may look like it contradicts "never
conclude." It does not, by design — verify the guards in `firmIntakeSummaryDownload.ts` (`resolveWageExposure`):
- It is **arithmetic from the uploaded records only** (e.g., hours logged vs. hours paid at a matching rate),
  never a legal damages/exposure opinion, and it carries a verbatim disclaimer to that effect.
- It is **triple-gated**: jurisdiction (a wage-rules layer must exist — CA only), firm subscription tier,
  and access tier (stripped from limited-preview exports).
- It refuses to estimate on ambiguous inputs (e.g., conflicting pay rates → returns null).
- Workers never see it; it is a firm/full-access surface only.
Evaluate whether those guards are sufficient — that is a fair thing to critique — but it is scoped
arithmetic, not a legal conclusion.

---

## 7. Context for evaluating known tradeoffs
These are disclosed so you can weigh them deliberately; how you score them is entirely yours.
- **`npm run typecheck` currently exits with errors.** They do not prevent the Vite production build, and
  the Vitest suite passes, but they reduce refactoring safety and weaken static guarantees. Evaluate them as
  meaningful type-safety debt (concrete triage in §7b).
- **Database migrations and edge-function deployments are operator-run** (Supabase SQL editor /
  `functions deploy`). This has been sufficient for the current cadence, but the process lacks automated
  promotion, rollback, and environment-consistency controls. Evaluate whether that is proportionate to the
  stage and what would be required before adding engineers or increasing deploy frequency.
- **CI runs the automated checks** (`.github/workflows/ci.yml`) but branch protection does not yet *require*
  them before merge. Verify the exact jobs in that file.
- **The "organize, never conclude" constraints are product requirements, not timidity.** Enforcement:
  `bannedVocabulary.ts`, the gated wage-exposure feature (§6c), the automated copy verb-test
  (`src/services/__tests__/marketingCopyGuardrails.test.ts`), and packet disclaimers.

## 7b. Measured baselines (2026-07-13)
- **`tsc --noEmit`: 58 errors, concentrated not diffuse.** ~25 (43%) are one repeated supabase-js
  query-typing pattern in `src/services/intakeDataService.ts` — fixing that wrapper's generics clears most at
  once. The rest are third-party type-shape mismatches (motion `Variants` in SageMarketingPage ×7; pdfjs
  `TextItem` in CitationPanel ×4) and loose props (App.tsx, CRM). No logic bugs found in the sample — this is
  type *hygiene* debt. (`@types/node` is not installed, which is the only reason 2 test files show
  `node:fs`/`node:url` errors; `npm i -D @types/node` clears those.)
- **Production bundle:** main chunk `index.js` ≈ **2.1 MB (575 KB gzip)**; CSS ≈ 205 KB (31 KB gzip). The PDF
  renderer (450 KB) and pdfjs worker (1.38 MB) ARE correctly code-split / lazy-loaded. The real weakness:
  **no route-level code splitting** — every screen is in the eager main chunk. `React.lazy` on the routes is
  the fix (and it dovetails with decomposing `App.tsx`).

## 8. Suggested scoring rubric (1–10 each, with what to examine)
| Dimension | Look at |
|---|---|
| Architecture / structure | `main.tsx`, `App.tsx`, services vs screens separation, the §6 flow |
| Code quality / consistency | naming, component size, duplication; `App.tsx` is the big critique |
| Type safety | `npm run typecheck`; judge the §7b triage |
| Test coverage | the §8b matrix — what risk each test prevents, not just the count |
| Security | §6/§6b: RLS policies, `firm_intake_routes`, edge-function auth, storage-vs-DB alignment |
| Performance / bundle | §7b numbers; lazy-loading; route-splitting gap |
| Accessibility | focus states, semantics, `prefers-reduced-motion` in marketing pages (not independently audited) |
| Compliance guardrails | `bannedVocabulary.ts`, the copy verb-test, §6c gating, packet disclaimers |
| Tech debt / maintainability | §7 tradeoffs, §7b, `App.tsx` size, manual migration workflow |
| Docs / onboarding | this packet + `docs/` (COPY_STYLE_GUIDE, LANDING_PAGE_CHECKLIST, legal-readiness) |

### 8b. Test-coverage matrix (what the 255 tests actually protect)
| Risk area | Current coverage |
|---|---|
| Wage arithmetic | Unit tests (`damagesGating`, `wageRules`) |
| Banned vocabulary / UPL | Automated guardrail tests (`bannedVocabulary`, `marketingCopyGuardrails`) |
| Packet assembly | Unit / integration-style tests (`firmIntakeSummaryDownload`, `intakePacketPresentation`) |
| AI system prompt integrity | Unit tests (`chatAssistant`) |
| CRM analytics / pricing | Unit tests (`crmAnalytics`) |
| **RLS isolation** | **Not covered in code** — verified by manual code audit; no automated DB-policy tests (pgTAP would close this) |
| Worker upload → packet flow | **Manual only** (no E2E) |
| Firm login → routing → view | **Manual only** (no E2E) |
| Auth / recovery | **Manual only** |
| PDF visual integrity | Sample fixture / manual |
| Stripe subscription lifecycle | Webhook logic partially unit-tested; end-to-end manual |
| EN/ES i18n completeness | Dictionary present; completeness not automatically asserted |

## 9. Fastest path to an informed opinion (30–45 min)
1. Level-A run → click through `/`, `/for-firms`, `/demo`.
2. Read `main.tsx`; skim `App.tsx`; open one full vertical: `UploadScreen` → `firmIntakeSummaryDownload.ts` →
   `firmIntakePdfRenderer.ts`.
3. Read `supabase/schema.sql` RLS section against the §6 flow and the §6b break-it questions.
4. `npm test` (green) and `npm run typecheck` (the §7b debt).
5. Skim `docs/` for the guardrail/compliance system.

## 10. Known limitations (honest)
- `App.tsx` is large and does a lot (candidate for decomposition; shows up in 3 rubric dimensions).
- `tsc` is not clean (§7b) — concentrated, ~1 focused day to move materially.
- No E2E/UI tests; RLS has no automated adversarial policy tests (§8b).
- CI is new and not yet blocking.
- Single-operator migration/deploy workflow; no one-command environment bootstrap yet.

## 11. Trust boundaries & sensitive data
This app processes highly sensitive employment records. What a security reviewer should know:
- **Stored:** worker profile, `intakes`, `uploaded_files` (bytes in the `intake-files` storage bucket),
  extracted text/facts, timelines, firm-routing rows, CRM data.
- **Sent to Anthropic:** document text/content, via the `extract-document-facts` and `chat-assistant` edge
  functions, under Anthropic's commercial API terms. Per the published Privacy Policy, that content is **not
  used to train models** (a claim the founder should confirm against the actual account terms).
- **PII redaction:** none automatic. The Privacy Policy advises users to redact SSNs/bank/medical numbers
  before upload. Evaluate whether that is sufficient for the data class.
- **Deletion/retention:** account/data deletion within 45 days of a verified request; automated backups may
  retain deleted data up to 90 days (per Privacy Policy). No self-service account deletion during beta.
- **Access to production data:** operator/staff, described as limited and logged — confirm the actual
  logging with the founder.
- **Prod/dev separation, error logging, and model-output logging:** confirm with the founder (not
  documented in-repo).

## 12. Environment & deployment status
- **Hosting:** frontend on Vercel (auto-deploys from `main`); backend on Supabase (Postgres, Auth, Storage,
  Edge Functions). Email via Resend (pilot notifications).
- **Demo:** `/demo` uses production code against an in-memory fixture (no separate demo build).
- **Deploy workflow:** git push → Vercel builds the frontend; **edge functions deploy separately and
  manually** (`npx supabase functions deploy <name>`) — the two are not in lockstep.
- **Rollback:** Vercel supports instant rollback of a frontend deploy; edge functions roll back by
  redeploying a prior version; DB migrations have no automated rollback.
- **Confirm with founder (not in-repo):** Stripe mode (test vs live), backup / point-in-time-recovery
  settings, error-monitoring tooling, and analytics beyond the in-app `web_events` tracking.

## 13. Review evidence (claim → how to verify)
```text
Claim: 255 tests pass                 → npm test
Claim: production build succeeds       → npm run build  (note bundle sizes, §7b)
Claim: type errors are concentrated    → npm run typecheck  (43% in intakeDataService.ts)
Claim: no secrets committed            → git history / secret scan; .env is gitignored, secrets live on edge fns
Claim: RLS isolates workers            → supabase/schema.sql policies + the §6b break-it attempts
Claim: PDF deps are lazy-loaded        → build chunk output (firmIntakePdfRenderer/pdf.worker split out)
Claim: copy guardrail blocks overclaims→ src/services/__tests__/marketingCopyGuardrails.test.ts (edit a page, run npm test)
Claim: reduced motion supported        → grep prefers-reduced-motion in src/app/screens; manual check
```
