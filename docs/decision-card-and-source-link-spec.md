# Decision Card + Source-Link Evolution — Spec

*Two linked upgrades to the firm packet: (1) a one-page **Decision Card** that lets an attorney decide in
minutes, and (2) the **source-link maturity path** to full AB 316 traceability. Written to teach from and build
against. Grounded in the current renderer (`firmIntakePdfRenderer.ts`) and citation panel (`CitationPanel.tsx`).
Last updated 2026-07-18.*

---

# PART 1 — The Decision Card

**What it is:** an upgrade of the existing Section 1 ("Review Snapshot", fed by `buildReviewSnapshot()`) into a
true one-page verdict placed **first**, before all other sections. Sections 2–11 become the case file that
follows. **No content is cut and no new data is required for v1 — it is a re-layout of data already computed.**

**Sizing (from the research):** attorney triage budget ≈ 2–3 min; careful reading ≈ 200 wpm → **target
~350–450 words, one page.** The top line must be **≤ ~35 words** (the 10-second glance).

**The card answers the attorney's 6 yes/no questions, in order:**

| Line | Answers | Feeds from (existing) | Limit | Guardrail |
|---|---|---|---|---|
| **0. Header + status** | — | `reviewOptions` readiness | pill: "Ready ✓" / "Needs docs" | status, not a verdict on the case |
| **1. Snapshot** | Who | cover: worker · role · employer · employment period | **≤ 35 words, one line** | facts only |
| **2. Claim** | Real claim? | `whyReview` (compressed) | ≤ 2 lines / ~30 words | *describe* the pattern; never "you have a valid claim" |
| **3. The Spine** | Protected act → adverse action → timing | top 3–5 of `sequence.events` | 3–5 dated lines, each `[view source]` | dates/facts only |
| **4. Damages** | Enough money? | `wageExposure` (8B) + lost-wages note | 1 line | "arithmetic from records — not a valuation or legal advice" |
| **5. Key Dates** | Is the clock running? | termination date + last protected-act date from events | 1 line | **surface dates only** — "for your timeliness assessment, not a deadline determination" (UPL) |
| **6. Evidence** | Provable? | `extracted.confirmedFacts` count + doc count (`records`) | 1 line: "X of Y facts confirmed · N docs" | count, don't opine |
| **7. Employer** | Collectible / covered? | cover `employer` + *(Phase 2)* company-site link | 1 line | external size = "estimate — verify," separate lane |
| **8. The Ask** | Take / pass / call | `reviewOptions` | 1 line | recommend a **workflow action** ("worth a call" / "needs docs"), never "take this case" |

**Then:** `Full case file (sections 2–11) follows ↓` — everything below, unchanged.

### The hard UPL lines baked into the card
- **Describe and surface — never conclude.** Claim line describes the pattern; it never says the case is valid/strong.
- **Dates, not deadlines.** Line 5 shows the dates so the *attorney* judges timeliness; one3seven never states a statute-of-limitations result.
- **Damages = arithmetic, not valuation.** Line 4 is records-based math with the standing disclaimer; it's the counsel-gated wage-exposure feature, so it only renders on a qualifying tier + jurisdiction + data.
- **The Ask is a workflow nudge, not legal advice.** "Worth a call" = a triage/workflow recommendation about *reviewing*, not a legal opinion on the merits.

### Optional intake additions (v1.1 — later, NOT before pilot)
Two neutral, non-leading questions would strengthen two card lines. Additions, not a reordering; worker flow unchanged.
- **Mitigation:** "Since then, have you been working or looking for work?" → strengthens Damages (line 4).
- **Employer size:** "Roughly how many people work there, if you know?" → strengthens Employer (line 7).
Both stay fact-gathering (cognitive-interview style); never a "do you qualify?" screener.

---

# PART 2 — Source-Link Evolution (the AB 316 traceability path)

**Why it matters:** AB 316 removes the "the AI acted on its own" defense, so an attorney needs every
AI-surfaced fact to be **auditable back to the worker's own document.** Source-linking *is* the AB 316 answer.
Good news: the hard mechanism already exists.

### How it works today (shipped)
`CitationPanel` is **snippet-anchored, not page-number-anchored.** It stores the verbatim source snippet, then:
opens the source PDF → searches every page's text layer for that snippet → **jumps to the exact page → draws a
highlight box around the exact matched run.** Clicking a citation lands the attorney on the exact page with the
exact line highlighted. (More robust than storing "page 4, line 12," which breaks if the doc changes.)
**Fallback:** a PDF with no text layer (scanned/photo) → page 1 + snippet in header + "highlight unavailable."

### The maturity stages

| Stage | What | Why | Status / effort |
|---|---|---|---|
| **0 · Exact-spot linking** | Snippet → exact page + highlighted run | The core capability | ✅ **Shipped.** Covers wage-exposure (8B) + key document quotes (2B) |
| **1 · Decision Card links** | Every `[view source]` on the card's Spine + Damages uses the same mechanism | The card is only credible if its lines are one click from proof | Near — **no new capability**, just apply existing citations to the card. Ships with the card |
| **2 · OCR on upload** | Run OCR when an uploaded doc has no text layer, so photos/scans become searchable | Much worker evidence is phone photos — today those fall back to "highlight unavailable" | Real build; **highest-value gap** for worker evidence |
| **3 · Provenance on ALL facts** | Extend source-links from wage/quotes to *every* extracted fact (§2B/§3) | Full "traceable, auditable" AB 316 story — every fact one click from its source | Phase-2 provenance work (extraction fn emits provenance). On roadmap |
| **4 · External convenience links** | Labeled, unverified out-bound links (employer website / size estimate) | "Knock it off the attorney's to-do list" — but a *separate lane* | Phase-2; **never mixed** with the authoritative citations |

### The rule that keeps stages 0–3 clean vs. stage 4
- **Stages 0–3 = authoritative provenance:** every link points into the **worker's own uploaded document**, at the exact spot. This is the AB 316 trust layer.
- **Stage 4 = convenience only:** external links (company site) are **inferred, unverified**, visually separate, labeled "verify." They are a courtesy, never part of the traced record.

---

## Sequence (what to build, in order)
1. **Decision Card v1** (re-layout only — Part 1) + **Stage 1 links** (apply existing citations to the card). This is the pre-pilot fix for "a lot to read." No new capability.
2. **Stage 2 — OCR on upload.** Biggest traceability gap for real worker evidence.
3. **v1.1 intake additions** (mitigation + employer size) — two neutral questions.
4. **Stage 3 — provenance on all facts** + **Stage 4 — external convenience links** (company site). Phase-2.

*Related: `docs/roadmap-phases.md`, and the reading-time model in this session's research.*
