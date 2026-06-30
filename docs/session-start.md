# Session-start ritual

At the beginning of any build session, ground the assistant in **actual** state, not
its memory of a few sessions ago.

## 1. Run one command
```
npm run state
```
Outputs: current branch + dirty files, last 10 commits, test pass/fail, total tsc
errors by file, and any SQL seeds/migrations sitting in `supabase/` (which are
operator-run, not auto-applied).

## 2. Paste the output into chat with this prompt
> Here's the current state (`npm run state` output below). Ground everything you
> tell me in this, not your memory. Before we start: in one short paragraph, tell me
> what changed since you'd expect, anything that looks off (failing tests, new tsc
> errors, unexpected dirty files), and confirm what's safe to build on.
>
> ```
> <paste output here>
> ```

## Notes
- **`main` auto-deploys to Vercel** → committed code is live.
- **SQL in `supabase/` is NOT auto-run** — it's applied by the operator in the
  Supabase SQL editor. If a feature depends on a column/table, confirm the seed/
  migration was actually run (e.g. `select tier, count(*) from crm_firms group by tier`).
- The standing **tsc backlog** (~50 errors in `intakeDataService.ts`, `App.tsx`,
  `CitationPanel.tsx`, etc.) is pre-existing and non-gating. Track *deltas* — a NEW
  tsc error in a file you just touched is the signal, not the absolute count.
