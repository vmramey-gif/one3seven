# Worker usability test — 5-second test + time-on-task

Phase 4 of the worker-dashboard plan. The only honest measure of the Home we built is whether a real
worker understands it fast and can finish their tasks. Run this with **5 people** (Nielsen: 5 users
surface ~85% of issues). Recruit people *like the actual user* — non-lawyers who've had a work problem —
not friends who already know the product.

Each session is ~20 minutes. Don't explain anything up front. Don't rescue them. Note where they
hesitate, where they look, and what they say out loud (ask them to think aloud).

---

## Part A — 5-second test (comprehension)

Show the **worker Home** for exactly 5 seconds, then hide it and ask:

1. "What is this screen for?"
2. "What are the 3 numbers at the top telling you?" *(records / dated events / still to gather)*
3. "What would you do next?"

**Pass bar:** ≥4 of 5 describe it as *"my case / my records, organized"* (not "a law firm", not "a to-do
app"). If people say "law firm" or "they'll take my case," that's a **doctrine-perception miss** — flag it.

Repeat the 5-second test on the **Important dates** card alone:

4. "What are these dates?"
5. "Is any of these a legal deadline?"

**Critical pass bar:** **0 of 5** may read a date as a filing deadline / "the clock is ticking." If even
one does, the card is implying a deadline we don't compute — fix the framing before anything else. This
is the UPL line, so it outranks every other finding here.

---

## Part B — Time-on-task (can they do it?)

Give each task as a goal, not instructions ("Show me how you'd…"). Record all three MeasuringU variants:
**time-to-complete** (successes only), **time-on-task** (everyone incl. failures), **time-till-failure**
(gave up). Also mark success (Y/N) and any wrong turn (error).

| # | Task | Success = | Target time |
|---|---|---|---|
| 1 | "Add a document to your case." | Reaches the upload screen and adds/attempts a file | < 20s |
| 2 | "Your name — is it on this? Add it if not." | Finds & fills the required *full name* field | < 30s |
| 3 | "You need to remember to send a form back Friday. Set that up." | Adds a reminder with a date | < 40s |
| 4 | "When did your termination get documented?" | Finds the date in *Important dates* / timeline | < 20s |
| 5 | "Get your pay records from your old employer." | Reaches *Get your employment records* | < 25s |

**Pass bar:** ≥80% task-success across the 5 users; median time ≤ target. A task under 50% success or
2× target is a redesign candidate, not a copy tweak.

---

## Part C — Accessibility spot-check (do this once, not per user)

- **Keyboard only** (no mouse): Tab through the Home. Can you reach + activate every action? Is the
  focus ring always visible? (We added focus-visible rings — confirm they show.)
- **200% browser zoom:** does anything overlap or get cut off? (This is exactly the bug class we just
  fixed on the Important-dates tag.)
- **Screen reader** (VoiceOver/NVDA) on the binder tabs: does it announce the *current* tab?
- **Color:** confirm every status/tag is legible and never color-only (tags carry text — good).

---

## Scoring sheet (copy per user)

```
User __  | recruited-like-real-user? Y/N
A1 purpose: ____________________  (pass if "my records, organized")
A4 dates:   ____________________
A5 deadline read? Y/N   <-- any Y = STOP, fix framing
Task 1 add doc      success:__  time:__  wrong turn:__
Task 2 name field   success:__  time:__  wrong turn:__
Task 3 reminder     success:__  time:__  wrong turn:__
Task 4 find date    success:__  time:__  wrong turn:__
Task 5 get records  success:__  time:__  wrong turn:__
Top confusion moment (verbatim quote): __________________
```

## What to do with the results

- **Any "this is a deadline" read (A5)** → fix the Important-dates / reminder copy first. UPL.
- **A task < 50% or 2× target** → redesign that flow.
- **Repeated confusion on the same element across ≥2 users** → that element, not the user.
- Re-run the affected tasks after each fix — a lightweight loop, not a one-time launch test.
