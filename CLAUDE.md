# one3seven — working agreement

Worker-first California employment legal-tech. A worker organizes their own source-linked employment
record, owns it, and chooses whether to share it with a plaintiff/employment firm. Firms are phase-1
distribution, not the identity. React 18 + TS + Vite 6, Tailwind v4, framer-motion; Supabase
(Postgres/Auth/Storage/Edge Fns); deploy to Vercel → www.one3seven.com.

## ⚠️ Verification gate — READ BEFORE SHIPPING
`npm run build` = `vite build` = **esbuild, NO typecheck.** A real type error will NOT fail the build.
So verify every change:
1. `npx tsc --noEmit` — count errors; must **not exceed the ~41 pre-existing baseline**. Grep the files
   you touched for NEW errors. (Baseline: 51 → 44 after deleting SageMarketingPage → 41 after removing the
   dead upload-consent wiring, both 2026-08-02. Remaining bulk is intakeDataService.ts Postgrest typing debt.)
2. `npx vitest run` — tests must stay green (incl. `marketingCopyGuardrails.test.ts`).
3. `npx vite build` — must succeed.
4. Read prop-safety by hand — esbuild won't catch a removed-but-dereferenced prop (runtime crash).
Deploy: `npx vercel --prod --yes`. Auth-gated firm flows can't be runtime-tested here.

## Doctrine — "organize, never conclude" (this is the UPL moat, not a style)
- The product organizes/reflects a record; it **never** characterizes what records establish, support, or
  are worth. Revelation is safe; conclusion is not.
- **Public/marketing surfaces are STRICTER than the product:** no merit verdict, no damages figure, no
  causal juxtaposition, no case-scoring language. Label samples "Illustrative" (once, not four times).
- **No metrics on the worker surface** (scores/percentages are counsel-gated). Coverage is a *locator*
  ("4 of 5 elements have material on file"), never a headlined "rate" on public pages — a headlined score
  is a deposition exhibit. Keep "we never calculate legal deadlines."
- Not a law firm; not a lawyer referral service; the worker *chooses* the firm (§6155 line).
- Before ANY customer-facing copy: run the verb test in `docs/COPY_STYLE_GUIDE.md`. Voice: throw the
  solution at the pain in the customer's words; specificity = authority; kill jargon.

## Design system (marketing/landing)
- **Display type: tight sans (Inter Tight, wght ~680, −0.03em).** NOT Fraunces — the founder rejected serif
  as "draft craft." (The `SERIF` const in landing screens now points at the sans stack; name kept to avoid churn.)
- **Glass sky background** = `.o3s-warm-sky` in `src/styles/theme.css`: diagonal sunshine→cream→sage→green
  with soft radial blooms; cards use `backdrop-blur`.
- **Signature (anti-"Word starter pack"):** monospace evidence rows (date · item · `» source` chip)
  and a left-gutter journey "spine." Distinctiveness = the mono evidence/provenance texture + motifs,
  not the typeface. Use real record fragments, never lorem. (No `α ≈ 1/137` mark — founder removed it.)
- **Color roles (hard rule):** `#5B21B6` VIOLET = AI ONLY, and NOT on marketing surfaces (marketing = sage
  + ink). Orange (`--o3s-action`) = user actions/attention. Sage `#42574E` = done/safe. Amber = confirm.
- Worker page = light glass, left-aligned journey. Firm page = same system; the dark cockpit tile is its hero.
  Both public pages must read as ONE brand (same fonts/nav/footer/137 mark).

## Naming
- Customer-facing feature = **Element Lens** (Claim Lens → Element Coverage → **Element Lens**, founder-locked
  2026-08-02). The coverage *readout* is a lowercase descriptor / locator — "element coverage: 4 of 5 elements
  have material on file" — NEVER a headlined "rate/score" on public pages (that's a deposition exhibit).
  Internal code keeps the codename `claimLens.ts` / `ClaimLensPanel` — do NOT rename identifiers. Locked
  marketing line: "Pick a theory. Element Lens reorganizes the file around it in seconds — including what you
  don't have yet." (Say "in seconds," not "two seconds" — don't ship a stopwatch claim you can't defend.)

## How to work here
- **HARD RULE — ALWAYS challenge your own answer before giving it. No exceptions.** Before presenting any
  recommendation, plan, name, copy line, or design call, state the strongest counter-argument against it and
  say whether it changes the call. Do this even when the user seems to want agreement, even for your own
  ideas, even when confident. Agreement without a challenge is a failure of the job. If after challenging it
  still holds, say so plainly — but the challenge must happen first, every time.
- **Only make a change if it's the best move for one3seven** — be the judgment filter, not an order-taker.
  Separate liability/revenue/credibility wins (do) from polish (flag) from change-for-change's-sake (push back).
  Never silently reverse a founder decision; surface contradictions.
- Rank the two real gates ABOVE features: **founder + IP paperwork with Tad**, and **UPL counsel sign-off**
  before any live firm touches Element Coverage.
- Persistent context lives in the auto-memory (`…/memory/MEMORY.md` index). Read it; it's the source of truth
  for decisions, doctrine boundaries, and open loops.
