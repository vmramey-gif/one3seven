# one3seven — Engine Doctrine

The canonical reference for what one3seven's organization engine does, does not do, and why —
consolidated from standing rules that previously lived scattered across founder decisions and
session notes. If a build decision touches worker-facing output, firm-facing output, extraction
logic, or the Element Lens library, it should trace back to something in this document. If it
doesn't, that's a gap — flag it, don't guess.

Read this before: writing any customer-facing copy, adding an Element Lens theory, changing what
the extraction engine outputs, or touching anything an attorney or worker sees on screen.

---

## 1. The one sentence

> one3seven transforms worker stories and records into organized summaries, chronologies,
> supporting record groupings, and information-gap indicators so workers and firms can begin
> review with clearer, more structured information.

## 2. What the engine is designed to do — and not do

**Designed to:** organize · identify · connect · summarize · timeline · surface gaps · prepare
information for review.

**Not designed to:** practice law · evaluate case strength · predict outcomes · determine
liability, damages, or merit.

This is both an ethics guardrail and a California State Bar AI-compliance choice, not a style
preference. It is the reason the product is legally defensible at all.

---

## 3. The doctrine chain, in order

Each rule below is a sharper, more operational descendant of the one before it. Apply the most
specific rule that covers the situation; when in doubt, the earlier/broader rule still governs.

### 3.1 "Describe the record, not the case" (the operational core)

**MAY measure:** presence, coverage, provenance, and completeness of records.
**MAY NOT characterize:** what the records establish, whether they support a legal theory, or how
they affect a matter's strength, value, or likely outcome.

*Revelation is safe; conclusion is not.* Stating two facts and their dates ("Nov 14 complaint
filed / Nov 25 first written warning in your record") lets the reader draw the inference — more
powerful than asserting it, and it stays clean. Concrete edits this rule forces:
- "Your file is getting **stronger**" → "documented coverage increases" (strong is interpretive;
  complete is measurable)
- "Your performance review is **missing**" → "No performance review is currently in the file" (the
  first assumes the document exists)
- Never one universal completeness % — measure each category on its own dimension
- "You need this to **prove your case**" → "This is missing from your file"

### 3.2 The verb test (mechanical enforcement of 3.1)

For every sentence attributed to one3seven, look at the verb. If it ascribes a legal act,
conclusion, or judgment, stop and rewrite.

- ❌ **Unsafe:** conclude · advise · recommend · rank · select · route · match · steer · score ·
  value · predict · determine · win · maximize · represent · guarantee · assess claim strength ·
  decide the matter.
- ✅ **Safe:** organize · reflect · surface · categorize · link · build a timeline · structure ·
  preserve · extract (facts from records) · flag (for attorney review).

Full avoid→use table, sales-script phrasing, and repeat offenders: `docs/COPY_STYLE_GUIDE.md`.
Check it before drafting any customer-facing copy — pages, scripts, cold emails, the AI system
prompt, demo text, packet labels. This is a pre-draft step, not a post-ship review; three copy
rounds in 2026-07 needed a UPL/fee-splitting pullback *after* drafting because this wasn't done
first.

### 3.3 Public surfaces get stricter rules than the product itself

Marketing/public surfaces reach everyone (not counsel-gated) and are also subject to
advertising-accuracy law (FTC / CA UCL) and State Bar advertising rules, on top of UPL. Never on a
public surface, even where the in-product counsel-gated version might eventually be allowed:
- Any damages/valuation figure
- Any merit verdict ("worth a review", success-colored states)
- Causal juxtaposition ("termination followed 41 days later") — implies a retaliation inference;
  state record contents factually instead
- Label any sample data "Illustrative example" so it can't read as a real client result

### 3.4 The one deliberate carve-out — firm-only wage-exposure arithmetic

One exception to "never determine damages," founder-approved 2026-06-18: a wage-exposure estimate
(PDF §8B + the attorney-review citation panel). This is **attorney work-product**, not a
conclusion about merit. Hard constraints:
- **Firm/attorney surface only** — never rendered to a worker, under any condition.
- **Arithmetic from records only** — §510 OT premium (0.5× regular rate/OT hour), §226.7 meal
  premium (1 hour regular rate/missed break) — never a statement of liability, owed amounts, or
  claim strength.
- Banned vocabulary in all generated copy: violation, owes, entitled, liable, strong, weak, valid,
  invalid, damages (the only permitted phrase is the section title "wage exposure estimate").
- If base hourly rate isn't determinable from records, do not estimate — flag incomplete.
- Hard disclaimer required: arithmetic from uploaded data only, no legal-exposure/viability/SOL/
  recoverable-damages assessment, attorney review required, not legal advice, no attorney-client
  relationship.
- Gated behind `DAMAGES_SURFACING_COUNSEL_APPROVED` — do not flip without explicit founder
  confirmation that counsel has cleared it.

### 3.5 Readiness / exposure surfacing stays counsel-gated until sign-off

A worker-facing legal-adjacent "Readiness"/"case" signal sits on the UPL line — it is a public
representation by a non-law-firm. The `/fire-demo` prototype (labeled demo, no real determination)
is fine to show. Do **not** port a Readiness band or new exposure surfacing into production
worker/firm screens, and never add "case"/"damages"/merits/likelihood language to any worker
surface, unless the founder confirms counsel has signed off on the exact strings.

### 3.6 Coverage Rate — the locked customer-facing metric

Say it identically every time:

> "Coverage Rate is the share of the firm's screening questions that the worker's submitted record
> can answer or meaningfully illuminate before staff reconstruction begins. It is not a judgment
> about whether the worker has a viable claim."

**Not:** conversion rate · acceptance rate · win rate · case strength · raw document count. A fuzzy
proprietary metric is worse than none — if it drifts into merits/UPL territory it stops being
doctrine-safe.

Product naming (locked, do not blur): the **feature** is **Element Lens**; the **metric it
reports** is **Coverage Rate**. Code identifiers stay `claimLens.ts` / `ClaimLensPanel` (rename
would be pure breakage risk, zero user benefit).

### 3.7 PI scope boundary

one3seven is **California employment law only.** PI/personal-injury/toxic-tort/"exposure" handoff
language may appear only on worker-owned summary/handoff screens, neutrally, telling the worker to
take those records to the right attorney themselves. It must never create firm-side PI review,
scoring, flags, injury/medical categories, or injury-damages summaries. The one legitimate
firm-side use of the word "exposure" is **wage** exposure (§8B, employment-only, tier-gated) — not
PI exposure.

---

## 4. Element Lens — the element-coverage engine

`src/services/claimLens.ts`. The attorney selects a lens (a legal theory); the intake's real facts
re-sort around that theory's statutory elements. For each element, every matching item is shown
with its source state, plus a loud absence card when nothing in the record touches it.

**Hard rules, enforced in the file itself:**
- Every element label **locates** material — it never **characterizes** it. No "protected
  activity," "adverse action," "pretext," "severity," "strong facts."
- **No ranking, no weighting, no omission** — every fact that touches an element is shown,
  whichever way it points. A fact that cuts *against* the worker's theory is surfaced, not hidden
  (verified by dedicated regression tests).
- Absence is a **fact**, rendered loudly — never a verdict.
- Matching is intentionally **over-inclusive**: showing a marginally-related item is safe (the
  attorney reads it and discards it); silently omitting one is not.
- A negation guard prevents "I don't have complaints" from false-positiving on "complaints."
  "Does-not-prove" exclude patterns are clause-scoped, not whole-text, so a genuine grant later in
  the same sentence as an earlier request/restriction still registers correctly.

**Current library: 33 theories** (as of 2026-08-17), covering retaliation (§1102.5, FEHA, §98.6,
§6310), FEHA discrimination/harassment/disability/interactive-process, the wage cluster (overtime
§510, meal/rest §226.7/512, wage statements §226, final pay §201–203, expense reimbursement §2802,
piece-rate §226.2, commission agreements §2751), separation theories (Tameny, constructive
discharge), the leave cluster (CFRA, FMLA, PDL, lactation, paid sick leave §246, other protected
leave), equal pay §1197.5, pay transparency §432.3, records requests, wage theft notice §2810.5,
exempt/non-exempt classification §515, independent contractor misclassification §2775 (ABC test),
non-compete voidness §16600/.1/.5, PAGA, CalWARN, SB 951 tech displacement, and a presence-only SB
553 workplace-violence-prevention compliance view.

**Counsel-gate discipline:** ship the engine, gate the surface. Every citation in every lens must
be reviewed by California employment counsel before it's surfaced to any real firm — the tool's
*behavior* is not legal advice, the *list* is. New lenses added since SB 951 (2026-08-17 batch)
follow the same convention: a code comment on each lens states what was verified against primary
sources (leginfo.legislature.ca.gov statutory text, DIR/DLSE, Cal/OSHA) versus what's still
secondary-source-corroborated and needs a final counsel check.

**When adding a new lens:** verify every citation against real, current primary sources before
writing a single pattern — not from training/memory recall. Check whether the theory has a real
size/headcount threshold (CFRA, FMLA, CalWARN, SB 951, §432.3, and §6401.9 all do — each has a
dedicated headcount element; a lens whose applicability depends on employer size without one is an
incomplete lens). Check whether the theory actually confers a private right of action before
modeling it as a retaliation-sequence lens — SB 951 and SB 553 needed real verification here; §6401.9
does not confer one, so its lens is presence-only by design, with the real retaliation path folded
into the existing §6310 lens instead.

## 5. The two-minute attorney read

Standing bar, stated explicitly by the founder (2026-08-17): **the attorney should be able to read
the intake and know what's going on in two minutes.** This is the actual product thesis, not a
nice-to-have — "walk in already organized, the client every lawyer wishes they had." Coverage
Rate, Element Lens, and the intake summary hero card all exist in service of this outcome.

Apply this bar whenever building or reviewing anything an attorney will actually read: key facts
surfaced at a glance (not buried behind a tab click), no dead ends or unexplained empty states,
Coverage Rate/gaps visible without opening every lens, consistent scannable structure across
theories. See `project_two_minute_attorney_read` in project memory for the live checklist and
findings from the first hard-challenge pass against this bar.

---

## 6. Enforcement mechanisms (what actually checks this, today)

- `docs/COPY_STYLE_GUIDE.md` — the verb test + avoid→use table for customer-facing copy.
- `src/services/bannedVocabulary.ts` — deterministic scanner for a fixed banned-term list
  (violation, owes, entitled, liable, strong/weak case, valid/invalid claim, guarantee, damages).
  Pure + used to gate output in tests and at runtime.
- `src/services/__tests__/marketingCopyGuardrails.test.ts` — scans a fixed file list for banned
  outcome/conclusion/trademark/pricing/metric copy. **Known coverage gap**: `SCANNED_FILES` does
  not currently include `HowItWorksScreen.tsx`, `LandingScreen.tsx`, or most of
  `src/app/constants/` — both screens are live, worker-facing, and currently clean, but nothing
  would catch a future regression in them. Widening this list is the single highest-leverage
  enforcement fix available.
- `claimLens.ts`'s own inline verb-test assertions (see `SB 951 tech-displacement lens... locates
  (never characterizes)` in `src/services/__tests__/claimLens.test.ts` for the pattern) — every
  lens added should get an equivalent test asserting no banned verb appears in any element name.
- **Not mechanically enforced, human-judgment-only today**: an implicit eligibility-quiz sequence
  in `src/i18n/i18n.tsx` (`wl.sly.*` keys — "Does any of this sound like you?") functions as
  case-screening without literally tripping the regex guardrail. Regex-based guardrails
  structurally cannot catch this class of thing; it needs a human legal read, not a code fix.

## 7. Known open items

- Widen `marketingCopyGuardrails.test.ts`'s `SCANNED_FILES` to cover `HowItWorksScreen.tsx`,
  `LandingScreen.tsx`, and the worker-facing constants files.
- Fix the dead-but-unvetted banned string `additionalReview: 'Additional review may be
  recommended'` in `workerIntakePresentation.ts` (not currently wired to any live screen — a
  landmine if it ever is, without another doctrine pass first).
- Get a human legal read on the implicit eligibility-quiz sequence in `i18n.tsx` (§6, above).
- Soften the implied-completeness claim in `i18n.tsx`'s `wl.lede` key ("...so when you sit down
  with a lawyer, nothing that matters gets missed") — an absolute guarantee-style claim the regex
  doesn't catch since it contains no literal "guarantee."
- Run a full hard-challenge pass of the attorney-facing intake view against §5 (the two-minute
  read bar) specifically — queued, not yet done as of 2026-08-17.
