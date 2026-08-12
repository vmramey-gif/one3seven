# Security change checklist

Run through this before considering any RLS policy, trigger, or privilege-check change done.
Reference it by name in the commit/PR (e.g. "per security-change-checklist.md"). Written
2026-08-12 after finding that a privilege-lock trigger shipped 2026-07-27 had silently never
worked — see `security_curriculum.md` finding #8 for the full story this checklist exists to
prevent from repeating.

- [ ] **Sibling-table sweep.** Grepped the schema for every OTHER table with the same
      sensitive-column shape (billing/plan columns, privilege/role columns, status columns a
      party could self-escalate) as the table just fixed, and checked whether the same class of
      bug applies there too — in this session, not deferred to a future audit. (`profiles` was
      fixed 2026-07-27; `firm_profiles`, structurally identical, wasn't checked until six weeks
      later — this is the mistake this item exists to stop repeating.)
- [ ] **RLS/trigger, not app-layer.** For every column this change restricts, confirmed the
      restriction is enforced by RLS or a trigger on the table itself — not by filtering on the
      read side in application code. App-layer redaction over a permissive RLS read is not a
      boundary; a direct API call bypasses it entirely.
- [ ] **Regression assertion written.** Wrote or extended a `scripts/rls-*-test.mjs` assertion
      that attempts the exact exploit this change closes, and confirmed it fails loudly
      (`assertDenied`-style: error OR zero rows affected counts as pass; a successful write with
      rows returned must fail the check) if the fix is reverted.
- [ ] **SECURITY DEFINER audit.** If this change touches a `SECURITY DEFINER` function, ran
      `npm run lint:security-definer` locally and confirmed clean. Independently confirm the
      function actually needs elevated privilege at all — most trigger functions that only
      read/write `NEW`/`OLD` don't, and `SECURITY DEFINER` should default to *off* unless there's
      a specific, stated reason (e.g. avoiding RLS self-recursion, as in `is_founder()`).
- [ ] **Live-attacked, not just read.** Verified the fix against the actual endpoint with a
      disposable throwaway account (create via Admin API, sign in with its own token, attempt the
      exploit via direct REST call, inspect the real response, delete the account after) — not
      "the migration applied," not "the policy text looks right," not "the trigger is enabled in
      the dashboard." Only a real attack attempt would have caught the finding-#8 bug; a
      migration succeeding proves nothing about whether the logic inside it actually works.

## Why this list and not something more automated

Two of the five items above (sibling-table sweep, RLS-vs-app-layer judgment) are genuinely not
mechanically checkable — no lint rule can tell you "this is a sibling table" the way one can spot
`current_user` inside a `SECURITY DEFINER` body. This file is a discipline mechanism, not a
guarantee, and should be read as one. The two items that *can* be mechanical
(`lint:security-definer`, the regression-assertion habit) are backed by an actual CI job and an
actual test harness respectively — see `.github/workflows/ci.yml` (`lint-security-definer`,
`rls-isolation`, `rls-firm-isolation`) and `docs/one3seven-security-hardening-roadmap.md` for the
full plan this checklist is one piece of.
