# one3seven — Engineer Review Packet

Everything a reviewer needs to run, understand, and score this codebase. Written for someone seeing it
for the first time.

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
- That's it for the frontend. Supabase CLI + Deno are only needed to run edge functions locally (optional).

## 3. Run it — three levels

### Level A — UI review, NO secrets (start here)
Lets a reviewer browse the whole UI without any credentials.
```bash
npm i
printf 'VITE_SHOW_DEV_GALLERY=true\n' > .env
npm run dev
```
- With Supabase env unset, the app shows a **dev screen gallery** (UI previews only; no fake sign-in).
- Visit **`/demo`** — the firm intake packet rendered from a built-in sample (Marcus Rivera fixture), no login.
- Visit `/`, `/for-firms`, `/terms`, `/privacy` — public marketing + legal pages.

### Level B — Full app with real data
Needs a Supabase project (the founder can provide URL + anon key, or use your own).
```bash
# .env
VITE_SUPABASE_URL=<supabase project url>
VITE_SUPABASE_ANON_KEY=<supabase anon key>
```
Then `npm run dev`. Now auth, worker intake, firm dashboard, and `/hq` (internal CRM) work against the DB.
Apply `supabase/schema.sql` + `supabase/migrations/*.sql` to your own project if standing up fresh.

### Level C — Edge functions (optional, advanced)
`supabase/functions/*` are Deno functions (chat-assistant, extract-document-facts, get-intake-intelligence,
stripe-webhook, create-checkout-session, create-portal-session, notify-pilot-lead). They need secrets set in
the Supabase project: `ANTHROPIC_API_KEY`, `SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY`, `STRIPE_*`,
`RESEND_API_KEY`, `PILOT_*`, `APP_URL`. **Do not commit these.** Deploy: `npx supabase functions deploy <name>`.

## 4. Commands
| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build (esbuild — does NOT typecheck) |
| `npm test` | Vitest — **255 tests** should pass |
| `npm run typecheck` | `tsc --noEmit` — ⚠️ **has pre-existing errors, see §7** |

---

## 5. Architecture map (where to look)
- **`src/main.tsx`** — entry + path-based routing (`/`, `/for-firms`, `/demo`, `/worker-demo`, `/terms`,
  `/privacy`, `/hq`, `/company-demo`, `/fire-demo`). Read this first to understand the surfaces.
- **`src/app/App.tsx`** — the main app state machine (screen routing, auth flow, worker/firm flows). Large.
- **`src/app/screens/`** (39) — top-level screens: `SageMarketingPage` (home), `ForFirmsPage`, `UploadScreen`
  (worker intake), `IntakeReviewScreen` (firm packet view), `FounderCRMScreen`/`FounderHQ` (internal CRM),
  `DemoApp` (the sample-fixture demo).
- **`src/services/`** — business logic: `firmIntakeSummaryDownload.ts` + `firmIntakePdfRenderer.ts` (the
  packet), `damagesCalculator.ts` / `damagesAssembly.ts` / `wageRules.ts` (wage-exposure arithmetic),
  `intakeDataService.ts` (data access), `bannedVocabulary.ts` (UPL word-blocking).
- **`src/i18n/i18n.tsx`** — EN/ES string dictionary.
- **`supabase/schema.sql` + `supabase/migrations/`** (44) — data model + **row-level security policies**.
- **`supabase/functions/`** (7) — Deno edge functions incl. the AI (`chat-assistant`, `extract-document-facts`).

## 6. Data model & security (worth grading)
- Postgres via Supabase. Core tables: `intakes`, `uploaded_files`, `intake_summaries`, `timeline_events`,
  `firm_intake_routes`, plus CRM tables.
- **Row-Level Security** is the isolation model: policies scope worker rows to `auth.uid() = worker_id`; a
  firm sees a record only via an explicit `firm_intake_routes` entry. Start in `supabase/schema.sql` (~line
  120+ for `enable row level security` + policies). This is the security core — review it directly.
- Edge functions authenticate the caller and use the service-role key server-side only.

## 7. What's INTENTIONAL — don't mis-score these
- **`npm run typecheck` does NOT pass cleanly.** There are pre-existing `tsc` errors (loose prop types,
  a few `any`s, some third-party type mismatches). The app builds and ships because Vite/esbuild transpiles
  without typechecking. Treat this as **real tech debt to note**, not a build breakage — the product runs and
  all 255 runtime tests pass. A fair score flags it; an unfair one calls the app "broken."
- **Migrations & deploys are applied manually** by the operator (Supabase SQL editor / `functions deploy`) —
  intentional for a solo-operated project, not an automation gap to fail.
- **CI was just added** (`.github/workflows/ci.yml`) and isn't yet a *blocking* check (needs branch
  protection). Before that, tests ran locally only.
- **The "organize, never conclude" constraints are product requirements, not timidity.** See the UPL
  guardrails: `bannedVocabulary.ts`, the gated wage-exposure feature, and the automated copy verb-test
  (`src/services/__tests__/marketingCopyGuardrails.test.ts`). Removing them would be a regression.
- **`.env.example` is UTF-16-encoded** (a known cosmetic wart); the two required vars are
  `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## 8. Suggested scoring rubric (1–10 each, with what to examine)
| Dimension | Look at |
|---|---|
| **Architecture / structure** | `main.tsx` routing, `App.tsx` state machine, services vs screens separation |
| **Code quality / consistency** | naming, component size, duplication; `App.tsx` is the big one to critique |
| **Type safety** | run `npm run typecheck`; judge severity of the pre-existing errors (§7) |
| **Test coverage** | `src/**/__tests__` — 255 tests; note what's covered (services, packet logic) vs not (UI) |
| **Security** | RLS policies in `schema.sql`; edge-function auth; no secrets committed; the isolation model |
| **Performance / bundle** | `npm run build` output; lazy-loading (pdf-lib is lazy-imported); image/asset weight |
| **Accessibility** | focus states, semantics, `prefers-reduced-motion` usage in marketing pages |
| **Compliance guardrails** | `bannedVocabulary.ts`, the copy-guardrail test, disclaimers in the packet |
| **Tech debt / maintainability** | the tsc errors, `App.tsx` length, manual migration workflow |
| **Docs / onboarding** | this packet, `docs/` (COPY_STYLE_GUIDE, LANDING_PAGE_CHECKLIST, legal-readiness) |

## 9. Fastest path to an informed opinion (30–45 min)
1. Level-A run → click through `/`, `/for-firms`, `/demo`.
2. Read `main.tsx`, skim `App.tsx`, open one full vertical: `UploadScreen` → `firmIntakeSummaryDownload.ts` →
   `firmIntakePdfRenderer.ts`.
3. Read `supabase/schema.sql` RLS section.
4. `npm test` (see it green) and `npm run typecheck` (see the debt).
5. Skim `docs/` for the guardrail/compliance system.

## 10. Honest known limitations
- `App.tsx` is large and does a lot (candidate for decomposition).
- `tsc` is not clean (§7).
- No E2E/UI tests (unit/logic tests only).
- CI is new and not yet blocking.
- Single-operator workflow (manual migrations/deploys) — fine at this stage, will need automation to scale.
