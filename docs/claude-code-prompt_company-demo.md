# Claude Code Build Prompt — one3seven Company Demo Guide

> Paste everything below into Claude Code, run from the root of the one3seven repo.
> The design reference file `company-demo.html` (the standalone prototype) should be
> placed in the repo root or `/docs` before running so Claude Code can read it.

---

## Context

You are working in the **one3seven** codebase — a React + Supabase plaintiff-side
employment-law intake platform. We are adding an internal **sales demo guide**: a
guided, click-by-click coach that helps our Director of Sales run a live product demo
for prospective law firms, plus a post-call **debrief capture** form.

A standalone HTML prototype already exists at `./company-demo.html` (read it first —
it is the visual + interaction reference for the guide UI: step cards, "Do this" rows,
dark speech bubbles, Coach/Present mode toggle, progress rail, panic strip). **Match its
look, copy, and step content exactly.** Reimplement it as proper components in our stack;
do not just iframe the HTML file.

## Before you write anything — discover our conventions

Do not assume. Inspect the repo and confirm, reporting back what you find:

1. **Router**: how routes are defined (React Router? file-based? where is the route table).
2. **Auth + gating**: how `is_founder` is read today, and whether a sales-rep role exists.
   Find the existing pattern that gates `/hq` and reuse it.
3. **Styling**: confirm Tailwind config, where the `#5B21B6` accent + brand tokens live,
   and the existing `Collapsible` component location.
4. **Supabase**: client location, how migrations are written/applied in this repo,
   and the existing RLS patterns (we have a passing RLS audit — match its style).
5. **Fonts**: how Syne / Inter are currently loaded (the demo guide uses Syne for display).

Report the conventions you found in a short list, then proceed.

## What to build

### 1. Route: `/company-demo` — the guided demo coach

- Reimplement the prototype as React components using our Tailwind setup and tokens.
- Five steps, content **verbatim from `company-demo.html`**: Open → Beat 1 (the mess) →
  Beat 2 (cited timeline) → Beat 3 (click one fact to source) → Close.
- Keep both modes: **Coach** (shows coaching notes, amber "Capture after" tags, the
  3-sentence panic strip) and **Present** (hides notes + capture tags, larger type, clean
  for screen-share). Toggle in the top-right, same as the prototype.
- Keep: progress rail with jump-to-step, Back/Next, left/right arrow-key nav, the
  reduced-motion and focus-visible accessibility already in the prototype.
- Reuse our existing `Collapsible` component anywhere the prototype implies expandable
  content rather than introducing a new one.

### 2. Beat 3 fallback (IMPORTANT — the citation jump is NOT built yet)

The fact-to-source citation hyperlink does **not** exist in the product yet. Tad must not
promise something the screen won't do. So in Beat 3:

- Add a clearly-marked **fallback note visible only in Coach mode** (style it like the
  existing `.note`, not the customer-facing bubble) reading:
  *"Citation jump isn't live yet — point to the source label on the fact and say the line
  below. Do not click anything you can't deliver."*
- Adjust the Beat 3 **spoken bubble** so it works WITHOUT a working hyperlink — describe
  that every fact is labeled with its source document and can be traced back, rather than
  saying "watch me click." Keep the "organizes and reflects, never concludes" line.
- Leave a `// TODO: wire to real citation jump once source-link feature ships` marker so
  it's easy to upgrade later.

### 3. Route: `/company-demo/debrief` — post-call capture

A short form Tad fills out within ~10 min of the call. Fields (match the prototype's
learning-capture section):

- Firm name (text) + prospect name (text)
- Her exact words for the pain (textarea)
- What made her lean in (single-select: The mess / The timeline / The citation moment / Other)
- What confused her or fell flat (textarea)
- Objections, verbatim (textarea)
- Feature requested we don't have yet (textarea) — with a dedicated checkbox:
  **"Asked to search / interrogate the record"** (this is a tracked signal — see note below)
- Outcome (single-select: Yes – design partner / Maybe – follow-up / No)
- Next step + date (text + date)
- One improvement for next demo (textarea)

On submit, write to Supabase (below) and show a clean success state in our interface voice
(no apology copy; "Saved — debrief logged" style). No HTML `<form>`-tag full-page submits;
use controlled inputs + an onClick handler, consistent with our codebase.

### 4. Supabase: new table `demo_debriefs`

Write a migration in our repo's migration style. Schema:

```
demo_debriefs
  id              uuid pk default gen_random_uuid()
  created_at      timestamptz default now()
  created_by      uuid references auth.users(id)
  firm_name       text not null
  prospect_name   text
  pain_phrase     text
  lean_in_moment  text          -- 'mess' | 'timeline' | 'citation' | 'other'
  fell_flat       text
  objections      text
  feature_request text
  asked_for_search boolean default false   -- tracked signal for AI-search trigger
  outcome         text          -- 'yes' | 'maybe' | 'no'
  next_step       text
  next_step_date  date
  improvement     text
```

**RLS** — match our existing audited patterns:
- Enable RLS on the table.
- Insert/select allowed only to founder + invited sales reps (same role check that gates
  `/hq` and `/company-demo`). A rep can read their own debriefs; founder can read all.
- No public access. No anon access.

### 5. Access gating for both routes

Gate `/company-demo` and `/company-demo/debrief` to **founder + invited sales reps**.
Reuse the exact mechanism that protects `/hq` — do not invent a new auth path. If a
sales-rep role does not exist yet, add the smallest extension to the existing role model
(e.g. an `is_sales_rep` boolean or a roles enum) consistent with how `is_founder` works,
and note clearly what you added so we can provision reps.

## The `asked_for_search` signal — why it matters (do not skip)

The `asked_for_search` boolean is a deliberate product-signal capture, not a throwaway
field. We are deciding whether to build scoped AI search over a worker's intake record,
and the trigger to build it is **real prospects asking for it in demos**. So:

- Surface it as its own checkbox in the debrief, not buried in the feature-request text.
- On the demo guide's **Dashboard or wherever debriefs are summarized** (if such a view
  exists or is trivial to add), show a simple count: "N of M demos asked to search the
  record." If no summary view exists, just leave the data clean and queryable — do not
  build a whole analytics page for this now.

## Constraints / house style

- **Scope discipline.** Build exactly the two routes, the table, and the gating. Do not
  refactor unrelated code, do not add libraries we don't already use, do not build the
  citation-jump feature itself (only the fallback copy + TODO).
- Match existing component, naming, and file-placement conventions you discovered.
- Keep the demo copy **UPL-safe**: the guide must never put legal-conclusion language in
  a customer-facing bubble. Preserve "organizes and reflects, never concludes."
- Mobile-first and accessible to the same standard as the prototype (focus-visible,
  reduced-motion, 44px tap targets).
- Run the test suite and make sure it's green before finishing (we keep suite green before
  every deploy).

## Deliverables — report back when done

1. The conventions you discovered (short list).
2. Files created/changed (paths).
3. The migration file + how to apply it in our setup.
4. What you added for the sales-rep role (if anything) and how to provision a rep.
5. Anything you intentionally left as a TODO (the citation jump) and where.
6. Confirmation the test suite passes.
