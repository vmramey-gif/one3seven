# CRM Call-Screen Restructure — Build Sheet

**Problem (not a bug):** `/hq` has **19 tabs across 5 suites**. Tad has to choose *where to look* before he can act, and the layout doesn't match how his brain moves through a call. Fix = make the **Dashboard the call screen**, sourced only from the **Sell** suite + live objection content; everything else is "between calls / end of day."

**Decisions locked (founder):**
- Call screen pulls from **Sell** (Dashboard · Firms · Pipeline · Add/Log · Activity) + the 5 objection prompts from **Learn → Scripts**. My Numbers / Learn / Team / Founder = not-during-a-call.
- **Deal brief is built from data we already have:** `CrmFirm` + `crmFirmIntel` (headlineWin, opener, topWins, fireCaseSignal, intakeNotes = ammunition). **Do NOT add** current-software / timekeeper-count fields — don't fix a hypothetical gap when a better real asset exists.
- **`convo` stage:** hypothesis, not fact. Do NOT cut from a guess — decide with Tad *after* real stage counts come in.
- Live stage distribution = a **permanent Dashboard strip**, not one-off SQL.

## Sequence (mirrors the provenance-slice discipline)

**Slice 1 — Stage-count strip on Dashboard. ✅ SHIPPED.**
`StageStrip` renders firms-per-stage in pipeline order (Target→Paid) with No/Nurture as a muted side-rail, from the already-loaded `firms`. Permanent "is the pipeline moving?" diagnostic; gives the real `convo` answer before any pipeline-logic change.

**Slice 2 — Deal-brief block (NEXT).**
A per-firm brief sourced from `CrmFirm` (name, attorney_name, phone, stage, priority, region, next_followup, notes, contacted_by) + `crmFirmIntel` (headlineWin, **opener**, topWins, fireCaseSignal, intakeNotes). Lives in the Sell flow (expand on a firm / a "call mode"). **Validation gate: put it in front of Tad on ONE real call before building anything else.** Code or not, that's the proof step.

**Slice 3 — Co-locate actions on the call screen.**
Relocate fast-log / advance-stage / set-next-action **and the 5 live objection prompts** (pulled from Scripts) onto the same call screen, so Tad never tab-hops mid-call.

**Slice 4 — `convo` fate.**
Only after real stage-count data: decide with Tad whether `convo` survives, collapses into Contacted, or stays.

## Field map (deal brief → existing data)
| Brief element | Source (already stored) |
|---|---|
| Who to call / firm + attorney | `CrmFirm.name`, `attorney_name`, `phone` (tap-to-call) |
| Where they are | `stage`, `priority`, `next_followup`, `contacted_by_name` |
| Opening line | `crmFirmIntel.opener` |
| Why they'll care | `crmFirmIntel.headlineWin`, `topWins`, `fireCaseSignal` |
| Intake notes | `crmFirmIntel.intakeNotes`, `CrmFirm.notes` |
| Objection handling | Scripts (5 prompts) |
| Log outcome / advance | existing fast-log + `crmStageLogic` |

Nothing here needs a new firm field or an edge-function deploy.
