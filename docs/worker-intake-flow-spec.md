# one3seven — Worker Intake Flow Spec
### Cognitive-Interview structured elicitation, with velocity copy baked in

> **BUILD STATUS (as of commit `8404bab`):**
> **SHIPPED (contained slice, no parent/DB contract change):** Screen 2 free narrative → Screen 3 safe factual recall aids, velocity/no-limbo copy, richness metric (`intake_story_submitted`, counts only, no PII). 248 tests pass.
> **STAGED for post-pilot build session:** Screen 1 context-reinstatement primer; Screen 4 category branching (touches `GuidedIntakeScreen`, needs e2e verified first); A/B vs. single-textarea control. Stage these *after* first pilot so the lift is A/B'd on real intakes and the core flow isn't refactored blind.
> **Through-line:** this deepens the moat but rides *alongside* the gate — the needle still moves on counsel ruling → deploys → first paying firm.


**Purpose:** This is the build spec for the worker-facing intake flow. It does the one thing Clio structurally cannot: it *elicits* a complete, accurate account using memory science, instead of *capturing* whatever a stressed person types into a box. The output is a richer, gap-free, source-linked record that lets the firm decide yes/no in one sitting — the engine behind the velocity + no-limbo thesis.

**Design constraints (locked):**
- **Velocity framing:** speed-to-decision and no-limbo, never speed-to-outcome. The velocity ladder terminates at *onboarding*. Stop there.
- **UPL discipline:** organizes and reflects, never concludes. No flow copy labels, characterizes, or evaluates the legal merit of anything the worker says.
- **"Case moves faster overall" handling:** ENABLE, DON'T AUTHOR. Worker-facing copy never claims faster outcomes. Firms may make that claim in their own marketing; one3seven never puts those words in front of a worker.
- **Pacing rule:** every follow-up is optional and skippable. Progress indicator always visible. Save & resume always available. Pair richness metric with completion rate — if completion dips, the flow is too heavy.
- **The velocity-claim verb test (permanent):** any velocity claim may only use verbs one3seven performs on *records* (organize, structure, surface, deliver). Never verbs performed on *cases* (settle, win, resolve, close). If a claim's object is a verb you don't control, cut it.

---

## Part 1 — The Cognitive Interview structure, adapted for async legal intake

The traditional Cognitive Interview (Fisher & Geiselman) was built for a live interviewer. We adapt its phases to a paced, self-guided, async flow. The phases run in this order because the order *is* the recall mechanism — free narrative first, detail funneling second. Reversing them suppresses recall.

| Phase | CI principle | What it does in the flow |
|---|---|---|
| 1. Settle & frame | Reduce stress; establish control | Lowers cognitive load so recall isn't blocked; gives the worker agency (pace, skip, resume) |
| 2. Context reinstatement | Mentally return to the setting | Primes episodic memory before any question is asked |
| 3. Free narrative | "Report everything," uninterrupted | Worker tells the story their way, at their pace — produces the 25–40% richness lift |
| 4. Factual recall aids | Alternative recall pathway when direct questioning misses detail | Unlocks detail via sequence, people, and documents — never emotional/physiological state (see Screen 3 safety rule) |
| 5. Funnel to detail | Drill specific facts *after* narrative | Captures the element-level facts the firm's decision needs |
| 6. Document anchoring | Tie facts to sources | Makes the record source-linked and gap-visible |
| 7. Close with control | Reinforce safety; confirm "done" | No-limbo signal: do it once → done |

**Two hard rules baked into every question:**
- **Open-ended, never leading.** "Tell me what happened" — not "Were you fired after you complained?" Leading questions edit memory.
- **No "why" questions.** "Why" reads as a demand for justification and triggers defensiveness. Use "what happened" / "what do you remember" / "help me understand" instead.

---

## Part 2 — The flow, screen by screen (with copy baked in)

### Screen 0 — Entry / settle & frame
**Header:** Let's organize your story.
**Body:** This takes about 15 minutes. You answer once, completely, at your own pace — so you're not stuck getting asked the same things over and over later. You can stop anytime and pick up right where you left off.
**Microcopy (the instinct-flip):** A few more minutes now means a firm can look at your full story in one sitting — instead of you waiting weeks for back-and-forth.
**Controls:** [Start] · progress bar (0%) · "Save & resume anytime" persistent.

> **Build note — velocity ladder, worker-facing version:** scattered records → organized story → a firm can look once. STOP. Do not extend to "decide faster for you," "win," "settle," or any outcome. The worker-facing ladder ends at *a firm can look at your full story.*

---

### Screen 1 — Context reinstatement (primes recall, feels like a warm-up)
**Header:** Let's start with where you worked.
**Fields:** Employer name · your role · roughly when you started · roughly when things changed or ended.
**Microcopy:** Take a second to picture your workplace — where you worked, who you worked with. It helps the rest come back more clearly.

> This screen looks like basic data capture (Clio stops here). Its real job is **context reinstatement** — the mental return to the setting that primes episodic memory for Screen 2. The "picture your workplace" line is doing cognitive work, not decoration.

---

### Screen 2 — Free narrative (the core recall engine)
**Header:** In your own words — what happened?
**Body:** Tell it however it comes to you. Don't worry about order, dates, or getting it perfect — just tell the story. We'll help you fill in details after.
**Input:** Large open text area + optional voice-to-text. No character minimum shown (a minimum pressures and suppresses). Autosave continuously.
**Microcopy:** There are no wrong answers here. Whatever you remember is the right place to start.

> **This is the 25–40% lift.** A static form asks "describe your issue" in a small box and gets a thin, ordered-for-the-form answer. The free-narrative phase, uninterrupted and unpressured, is what produces a complete account. **Do not interrupt this phase with field validation, required follow-ups, or "did you mean" prompts.** Let it run.

---

### Screen 3 — Factual recall aids (alternative recall pathway — SAFE VERSION)
**Header:** A few things that sometimes bring more back.
**Body:** These are all optional. Skip any that don't fit.
**Prompts (each individually skippable):**
- As best you remember, what happened first — then what came next?
- Who else was there? Names or roles are both fine.
- Was anything written down or sent — emails, texts, letters?
- Was there a specific moment that stands out? *(an event, not a feeling)*

**Microcopy:** Sometimes walking through the order of events, or who was involved, brings back a detail the direct questions miss. No pressure to answer all of these.

> **SAFETY RULE — DO NOT REVERT.** This screen reaches detail Screen 2 couldn't, using **factual recall aids only** — sequence, people, documents, standout *events*. The earlier draft of this spec used sensory/feeling-state prompts ("what were you feeling," "what you remember hearing/seeing"). **Those were cut and must stay cut.** Those techniques come from trauma-informed interviewing literature that assumes a trained clinician or investigator in a live, supervised setting. In a self-serve, unsupervised product aimed at freshly traumatized fire-displaced workers, the same prompts become trauma-*probing*, with no human in the room — outside one3seven's employment-only / no-health scope and a real liability. **Permanent rule: recall aids anchor on events, sequence, people, and documents — never on the worker's emotional or physiological state.** Every prompt stays optional so it adds richness without adding drop-off.

---

### Screen 4 — Funnel to detail (element capture, now that the narrative is out)
**Header:** Now let's fill in a few specifics.
This screen **branches by category** (see Part 3). The branch is chosen from a single early routing question ("What's this mostly about?") so the worker only sees prompts relevant to their situation.

**Universal funnel questions (all categories):**
- Roughly when did each key thing happen? (date-assist UI; "approximate is fine" reassurance)
- Did you ever raise a concern or complaint to anyone? To whom, and when? *(captures protected activity — surfaced, never labeled)*
- Was there a moment something changed for you at work — a write-up, a schedule change, being let go? When? *(captures adverse action — surfaced, never labeled)*
- Was anyone treated differently than you in a similar spot? *(captures comparators)*
- Who else saw or knew about any of this? *(captures witnesses — capture contact info now, before people scatter; acute for fire-displaced surge)*

**Microcopy:** Approximate dates are fine — "around March" is useful. We're building a timeline, not a test.

> **UPL firewall:** these questions *surface* the protected-activity → adverse-action → timing sequence. The flow never connects them, never says "retaliation," never says "pretext." It lays facts on a timeline; the attorney draws the conclusion. The parenthetical labels above are **build-side annotations only — they must never appear in worker-facing copy.**

---

### Screen 5 — Document anchoring (source-links the record)
**Header:** Do you have any of these? Upload what you have — skip what you don't.
**Body:** Pay stubs, schedules, texts or emails, write-ups, your termination letter, anything you wrote down at the time. Even photos of paper documents work.
**Microcopy:** Don't have something? That's fine — upload only what you have. Missing pieces don't stop you.

> Makes the record **source-linked and gap-visible.** The "skip what you don't have" framing keeps completion high while still surfacing which documents exist vs. are missing — itself useful signal for the firm.

---

### Screen 6 — Close with control (no-limbo signal)
**Header:** That's it — your story is organized.
**Body:** You answered once, and you're done. Your organized intake is ready for review. You won't need to repeat any of this.
**Microcopy:** Do it once → done.

> Reinforces the no-limbo thesis at the exact moment it lands hardest. This is the worker-side payoff of front-loaded completeness: they are *out of the loop of being asked the same things three times.*

---

## Part 3 — Category branching (Screen 4)

One routing question early: **"What's this mostly about?"** → routes to the right funnel branch. All branches feed one shared chronology object (six input schemas, one output spine). Each branch's specific funnel questions map to that category's legal elements — so every captured fact ties to something an attorney must evaluate. (Map each branch to its CACI element list during build; the universal questions above already cover the protected-activity/adverse-action/timing spine common to all.)

| Branch | Category-specific funnel additions (surfaced, never labeled) |
|---|---|
| Pay / hours | Hours actually worked vs. paid; missed/late/interrupted breaks; promised vs. actual pay |
| Time off / leave | The request and the response; dates; what happened after |
| Discrimination / harassment | The pattern over time; comments/exclusions; review history; comparators |
| Contracts / leaving a job | The agreement/clause; when employment ended vs. agreed term; any repayment demand |
| Safety / privacy | The hazard or concern raised; to whom; what happened after; any official filing |
| Union / group activity | The activity; the employer's response; timing |

> Branch routing keeps the flow short *per worker* — they never see the other five branches. This is how richness goes up without the flow feeling heavy.

---

## Part 4 — Metrics wiring (instrument from day one)

Two metrics, paired, non-negotiable:

1. **Statement richness** — distinct facts captured per intake (count of populated chronology nodes + word count of free narrative + document count). This is your proof of the cognitive-interview lift.
2. **Completion rate** — % who start and reach Screen 6.

**The guardrail:** these two move together or you've broken something. Richness up + completion flat/up = the flow is working. Richness up + completion *down* = the flow got too heavy; trim or make more skippable. Never trade completion for richness.

**The proof asset:** run the CI flow against a plain-form control (A/B). The richness delta — targeting the documented 25–40% range — becomes a sales asset you can show firms on *your own data*, not a citation.

---

## Part 5 — What this beats, in one line

- **Clio captures what the worker types into boxes.** one3seven **elicits what the worker actually experienced**, using memory science, and **organizes it** into the firm's decision-ready record.
- Velocity claim, worker-facing: *answer once, completely → a firm can look at your full story in one sitting → you're not stuck in limbo.*
- Velocity claim, firm-facing: *scattered records → organized intake → fast decision → fast onboarding.* Full stop.
- The "case moves faster overall" benefit is real — and it is **the firm's to claim, never one3seven's to promise.**
