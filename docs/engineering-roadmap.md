# Engineering Roadmap

**Created:** 2026-07-13 · **Context:** post external engineer review (packet scored 8.7/10; project
engineering-maturity ~7.8–8.3/10 pending direct code review). **Pilot target:** Aug 3, 2026.

**The honest frame:** the review-packet rewrite made this project *legible*, not *more mature*. Documentation
quality and engineering maturity are different axes. This roadmap is the work that actually raises the second
one. Nothing here is required to run the Aug 3 pilot; it is the reliability/maintainability backlog for the
phase right after.

**Do not let this compete with the pilot.** Sequence is: ship the pilot → one focused reliability week →
then the larger refactors. The only item worth doing *before* the pilot is the 2-minute CI setting (#2).

Cross-refs: [legal-readiness-aug3.md](legal-readiness-aug3.md) (compliance gate) and
[attorney-brief.md](attorney-brief.md) (contracts). Where items overlap those docs, it's noted — keep the
three in sync so they don't drift (see the "statewide line" contradiction for why that matters).

---

## Already done (2026-07-13) — don't re-litigate
- ✅ Automated copy verb-test expanded to CRM/AI/demo surfaces + CI workflow added
  (`.github/workflows/ci.yml`). *Shared with the compliance work in legal-readiness-aug3.md.*
- ✅ `.env.example` converted to UTF-8.
- ✅ Review packet v2 (data-flow, coverage matrix, reproducible setup, trust/env/evidence).
- ✅ Measured baselines captured (tsc: 58 errors; bundle: 2.1 MB / 575 KB gzip main chunk).

---

## This week — cheap, independent, do before pilot
### 2. Make CI blocking  ·  effort: ~2 min  ·  no dependencies
The CI workflow exists but only *reports*. Enable branch protection on `main` requiring the `test` check
(GitHub → Settings → Branches). Nearly free; closes the gap documented in the review.
*Overlaps legal-readiness-aug3.md — the guardrail test only truly protects compliance once this is blocking.*

### 0. Add `@types/node`  ·  effort: ~5 min  ·  no dependencies
`npm i -D @types/node`. Clears the only 2 tsc errors that are pure tooling (the `node:fs`/`node:url` errors
in test files). Trivial, and shrinks the tsc count before anyone runs `npm run typecheck`.

---

## Post-pilot reliability week (after ~Aug 3–10) — highest leverage
### 1. Triage & fix `tsc`  ·  effort: ~1 focused day  ·  DO BEFORE #3
58 errors, concentrated. Plan:
- **~25 (43%)** are one repeated supabase-js query-typing pattern in `src/services/intakeDataService.ts` —
  fix that wrapper's generics; most clear at once. *(This alone is worth ~1 hour and is low-risk — every call
  site is covered by passing tests. Could even be pulled forward to before handoff.)*
- **Third-party shapes** (motion `Variants` in SageMarketingPage ×7; pdfjs `TextItem` in CitationPanel ×4):
  suppress with typed casts + a comment explaining why.
- **Loose props** (App.tsx `void` vs `Promise<void>`, CRM, story services): fix or track as a numbered backlog.
- No logic bugs found in the sample — this is type *hygiene*, so the risk of the fixes is low.
- Target: type-safety 5 → ~8, tech-debt 6 → ~8. **Do this before #3** — don't refactor App.tsx while also
  fighting its type errors.

### 5. Route-level code splitting  ·  effort: hours–1 day  ·  dovetails with #3
Main chunk is 2.1 MB (575 KB gzip) because every screen ships eagerly. Apply `React.lazy` to the screen
routes in `main.tsx`/`App.tsx`. PDF libs are already split correctly — this is the remaining perf lever.
Naturally pairs with #3.

---

## Next engineering project (post-pilot, before a 2nd engineer)
### 3. Decompose `App.tsx`  ·  effort: days  ·  depends on #1
The main state machine is over-concentrated; it shows up in 3 review dimensions (architecture, code quality,
tech debt). Highest-leverage single refactor. A second engineer would otherwise have to learn one giant file
to touch anything. Do **after** #1 (clean types first) and ideally alongside #5 (as you split routes, you
split App).

### 4. Thin E2E layer  ·  effort: 1–2 days  ·  independent
Not comprehensive — just the 3–4 flows that are catastrophic if silently broken:
- worker upload → packet generation
- firm login → dashboard view
- Stripe checkout → subscription active
Optionally add **RLS policy tests** (pgTAP) here — §8b of the review packet flags RLS isolation as verified
by manual audit only, with no automated adversarial tests. Turns "255 tests, logic only" into diligence-grade
confidence.

---

## Dependency graph (quick reference)
```
#2 CI-blocking      → independent, do now
#0 @types/node      → independent, do now
#1 tsc triage       → do before #3
#5 route-splitting  → pairs with #3
#3 App.tsx decompose→ after #1
#4 E2E + RLS tests  → independent, post-pilot
```

## What NOT to chase before Aug 3
Accessibility polish and perfect type coverage are real but lower-urgency than the pilot. A 10/10 codebase
with a missed pilot date is worse than a 7/10 codebase with three paying firms. Ship first.
