# ONE3SEVEN — Intelligence Consistency Audit
**Date:** June 2026 | **Mode:** Read-only | **Status:** Complete

---

## Executive Summary

The PDF and firm review screen are NOT generated from independent code paths. Both receive the exact same `FirmLiveIntakeView` object. The source data is shared.

The divergence is narrower and more specific: **two counting systems that do not agree with each other**, visible simultaneously on the screen but resolved differently in the PDF.

---

## Complete Dependency Map

### Firm Review Screen — All Four Generation Paths

#### 1. Timeline
| Layer | Source |
|---|---|
| DB | `intake_timeline_events` table |
| Loader | `fetchIntakeSummaryBundle()` → `bundle.events` |
| View object | `firmLiveView.events[]` |
| At-a-Glance count | `firmLiveView.events.length` |
| Screen render | `IntakeReviewScreen.tsx` — maps `firmLiveView.events` |

**Verdict: Single source. No divergence possible.**

---

#### 2. Clarifications — THIS IS WHERE IT BREAKS

The screen has **two separate gap-related sections** that use **two different data sources**:

**Section A — "Missing Documents" card** (`IntakeReviewScreen.tsx` lines 2398–2407)
```
Source: firmLiveView.missing
Origin: intake_summaries.missing_document_alerts (DB, Phase 2A)
Visibility: Always shown when items exist — regardless of intelligence
```

**Section B — "Items Requiring Confirmation" / "Clarifications Needed" panel** (lines 1929–1954)
```ts
const intelligenceItems = firmLiveView?.intelligence?.confirmationNeeded ?? []
const fallbackItems = chronologyGapLines  // = firmLiveView.missing + additionalContext, deduped, max 5
const items = intelligenceItems.length > 0 ? intelligenceItems : fallbackItems
```
- When Phase 2B present → shows `intelligence.confirmationNeeded`, title = "Items Requiring Confirmation"
- When Phase 2B absent → shows `chronologyGapLines` fallback, title = "Clarifications Needed"
- **ONE OR THE OTHER — never both in this panel**

**The At-a-Glance badge count** (`IntakeReviewScreen.tsx` line 1107)
```ts
const gapCount = chronologyGapLines.length
// chronologyGapLines = [...firmLiveView.missing, ...firmReadinessPresentation.additionalContext]
```
- **ALWAYS uses Phase 2A data (`firmLiveView.missing`)**
- **NEVER reflects `intelligence.confirmationNeeded` count — even when Phase 2B is present**

---

### PDF — All Four Generation Paths

**Entry point** (`IntakeReviewScreen.tsx` line 615):
```ts
downloadFirmIntakeReviewDocument(firmLiveView)
// Passes the SAME firmLiveView object — no re-fetch
```

**PDF chain:**
```
downloadFirmIntakeReviewDocument(view)
  → buildFirmIntakeReviewPdfLines(view)
    → firmViewToExportPayload(view, tier)
    → buildFirmPolishedPacketPdfLines(view, payload, tier)
```

#### PDF Timeline
```ts
timelineEvents: view.events.map(...)   // same firmLiveView.events
```
✅ **Consistent with screen**

#### PDF Record Count
```ts
documentsUploaded: view.files.length   // same firmLiveView.files
```
✅ **Consistent with screen**

#### PDF Section 2B (Extracted from Documents)
```ts
const intel = view.intelligence        // same firmLiveView.intelligence
```
✅ **Consistent with screen**

#### PDF Section 8 (Items Requiring Confirmation)
```ts
// firmIntakeSummaryDownload.ts lines 867–869
const confirmItems = intel?.confirmationNeeded?.length
  ? intel.confirmationNeeded                                    // Phase 2B path
  : buildItemsRequiringConfirmation(view, linkedEvents, ...)    // DIFFERENT fallback function
```

#### PDF Section 10 count
```ts
const unresolvedCount = confirmItems.length   // from intelligence OR heuristic — NOT from view.missing
```

---

## The Three Divergences

### Divergence 1 — At-a-Glance badge vs PDF Section 10 count
**The most visible inconsistency to a firm.**

| Surface | Source | When Phase 2B has 2 items, Phase 2A has 3 alerts |
|---|---|---|
| Screen badge | `chronologyGapLines.length` (Phase 2A always) | Shows **"3 clarifications needed"** |
| PDF Section 10 | `confirmItems.length` (Phase 2B when present) | Shows **"2 items requiring confirmation"** |

A firm downloads the PDF after reading the screen. The number is different. They do not know why.

---

### Divergence 2 — Screen has two gap sections; PDF has one

When Phase 2B intelligence is present, the screen shows:
1. **"Missing Documents" card** — from `firmLiveView.missing` (e.g., 2 items)
2. **"Items Requiring Confirmation" panel** — from `intelligence.confirmationNeeded` (e.g., 2 items)

Total concerns visible on screen: **4**

The PDF Section 8 shows:
- `intel.confirmationNeeded` only → **2 items**

The `firmLiveView.missing` items exist in `payload.missing` but are rendered differently in the PDF structure — they do not appear as a separate named section matching what the screen shows.

Firm reaction: *"The summary showed 4 things. The PDF shows 2. Where did the other 2 go?"*

---

### Divergence 3 — Fallback generators produce different output

When Phase 2B intelligence has NOT run (null):

| Surface | Fallback Source | Logic |
|---|---|---|
| Screen | `chronologyGapLines` | `firmLiveView.missing` + `additionalContext`, deduped, capped at 5 |
| PDF Section 8 | `buildItemsRequiringConfirmation()` | Checks date discrepancies, coworker statement timing, missing categories — different heuristic |

Same intake, Phase 2B absent → screen and PDF show different items in different order with different wording.

---

## What Is NOT a Problem

- Timeline counts are identical (same source)
- Record counts are identical (same source)
- Phase 2B content (timing intervals, key quotes, extracted facts) is identical when present (same `view.intelligence`)
- No re-fetch occurs at PDF download time — same object, no stale data race

---

## Root Cause Statement

```
firmLiveView has two gap-related fields:
  - view.missing              ← Phase 2A, always populated from DB
  - view.intelligence.confirmationNeeded  ← Phase 2B, populated after extraction

The screen renders BOTH fields (in different sections).
The PDF renders only ONE (intelligence preferred, different heuristic as fallback).
The At-a-Glance badge counts only the Phase 2A field regardless of Phase 2B state.

Result: three surfaces, three different numbers, all from the same object.
```

---

## Recommended Fix Path

### Short-term (one line, safe, no architecture change)

Fix the At-a-Glance badge to use the same count as the PDF and panel:

```ts
// IntakeReviewScreen.tsx — around line 1107
// CURRENT:
const gapCount = chronologyGapLines.length

// REPLACE WITH:
const intelligenceConfirmCount = firmLiveView?.intelligence?.confirmationNeeded?.length ?? 0
const gapCount = intelligenceConfirmCount > 0
  ? intelligenceConfirmCount
  : chronologyGapLines.length
```

**Effect:** When Phase 2B is present, the badge count matches the panel and the PDF. One number everywhere.
**Risk:** Minimal. Badge shows a different number in the same cases where the panel already shows a different title ("Items Requiring Confirmation" vs "Clarifications Needed"). The UI already changes — the badge should change too.

---

### Medium-term (review_packet_v1 — eliminates all three divergences)

Define a single consolidated clarifications array in the packet:

```ts
interface ReviewPacketV1 {
  // ... other fields ...
  clarifications: string[]
  // Union of intelligence.confirmationNeeded and missing_document_alerts
  // Deduplicated, ordered by specificity (intelligence items first)
  // Both screen and PDF read packet.clarifications — never their own version
}
```

Both surfaces read `packet.clarifications`. Count is always identical. Content is always identical. The divergence becomes structurally impossible.

---

## Files Involved

| File | Role | Change Needed |
|---|---|---|
| `src/app/screens/IntakeReviewScreen.tsx` | Renders screen, computes gapCount, two gap sections | Short-term: fix gapCount (line ~1107) |
| `src/services/firmIntakeSummaryDownload.ts` | Builds PDF, Section 8 fallback heuristic | Medium-term: read from packet |
| `src/services/intakeDataService.ts` | Loads `FirmLiveIntakeView`, fetches intelligence | Medium-term: compute `clarifications[]` here |
| `src/services/documentFactsService.ts` | Defines `IntakeIntelligence` type | Medium-term: feeds into packet |

---

## Consistency Test (build this before the short-term fix)

```ts
// evals/consistency.test.ts
import { loadFirmLiveIntakeView } from '../services/intakeDataService'
import { buildFirmIntakeReviewPdfLines } from '../services/firmIntakeSummaryDownload'

test('Crestline: screen panel and PDF Section 8 agree on clarification count', async () => {
  const view = await loadFirmLiveIntakeView(CRESTLINE_INTAKE_ID, ...)

  // What the panel shows
  const screenItems = view.intelligence?.confirmationNeeded?.length
    ? view.intelligence.confirmationNeeded
    : []  // fallback path — check separately

  // What the PDF shows (parse Section 8 line count from PDF lines)
  const pdfLines = buildFirmIntakeReviewPdfLines(view)
  const section8Start = pdfLines.findIndex(l => l.includes('Items Requiring Confirmation'))
  // ... count bullet items after section8Start ...

  expect(screenItems.length).toBe(pdfSection8Count)
})

test('Crestline: At-a-Glance badge count matches panel item count when Phase 2B present', async () => {
  const view = await loadFirmLiveIntakeView(CRESTLINE_INTAKE_ID, ...)
  const intelligenceCount = view.intelligence?.confirmationNeeded?.length ?? 0

  if (intelligenceCount > 0) {
    // Badge should NOT be showing view.missing.length — it should match intelligence
    expect(intelligenceCount).not.toBe(view.missing.length ?? 0)
    // After the fix, this test becomes: badge count === intelligence count
  }
})
```

---

## Decision

| Option | Effort | Risk | Eliminates |
|---|---|---|---|
| A. Fix gapCount (1 line) | 30 min | Minimal | Divergence 1 |
| B. Remove duplicate "Missing Documents" card when Phase 2B present | 1 hour | Low | Divergence 2 |
| C. Align fallback generators | 2 hours | Low-medium | Divergence 3 |
| D. review_packet_v1 (full fix) | Sprint-level | Requires careful migration | All three |

**Recommended next prompt:** ONE3SEVEN SAFETY MODE — fix gapCount (Option A). Single line. Write the consistency test first, confirm it fails, apply the fix, confirm it passes. Stop.
