# one3seven — Voice Interface Spec (Worker Guided Intake)
### A warm spoken interview that is mechanically a FIXED SCRIPT, not a generative agent

> **BUILD STATUS:** Post-pilot. Bank this; build after the text flow is A/B'd so you have a richness baseline to measure voice's lift against. Does not touch the gate (deploy → counsel → first paying firm).

> **WHAT THIS IS:** A voice rendering of the already-shipped, already-vetted guided questions. The worker taps "guided questions," a calm assistant greets them and walks them through the *exact fixed prompts* one at a time, conversationally. It *feels* like being interviewed by a kind person. It is *actually* a vetted script spoken aloud with warm pacing.

> **WHAT THIS IS NOT:** A generative interviewer that decides its own follow-ups based on what the worker says. That version was explicitly rejected — it reintroduces the no-clinician trauma-probe risk and the UPL "concludes" risk. See the hard line below.

---

## The hard line: interface vs. agent

| | Voice INTERFACE (this spec — safe) | Generative AGENT (rejected) |
|---|---|---|
| Question substance | Fixed, pre-vetted script | Invented in real time |
| Reacts to answer content | No | Yes |
| Can be vetted before shipping | Yes — you know every word it will say | No — by definition unknowable until said |
| Trauma-probe risk | None — can't follow emotional threads | High — following threads is what interviewers do |
| UPL "concludes" risk | None — never characterizes | High — drifts toward "that's retaliation" while trying to help |

**The trick:** the worker's experience is *"a kind assistant interviewed me."* The system reality is *"a vetted script was spoken with warm pacing."* Identical to the worker; worlds apart on risk.

---

## The two-layer rule (this is the whole safety model)

Every spoken line falls into exactly one of two buckets:

**Layer 1 — SUBSTANCE (locked, fixed, vetted):** the actual questions. These are the exact prompts from the shipped intake flow. The assistant may *only* speak these, verbatim, in fixed order. It cannot add, modify, or generate a substantive question.

**Layer 2 — CONNECTIVE TISSUE (warm, allowed, bounded):** pacing and acknowledgment glue between fixed questions — *"got it," "thanks, that's helpful," "take your time," "ready for the next one?"* This is what makes it feel conversational. It is confirmation and pacing only.

**The bright line between them:** Layer 2 may acknowledge *that* the worker answered. It may never react to *what* the worker said. "Got it" ✅. "That sounds really hard" ❌ (reacts to content → emotional probe). "Thanks — ready for the next one?" ✅. "That detail could matter for your case" ❌ (characterizes → UPL).

---

## The conversation sequence

### Entry — settle & frame
🔊 *"Hi. I'm going to help you organize your story, in your own words. This takes about fifteen minutes. You can talk, or type — whatever's easier — and you can stop anytime and pick up right where you left off. Want to start?"*
→ worker speaks or taps **Start** · **Type instead** toggle visible · silence 8s → *"Take your time. Tap when you're ready,"* then waits.

### Context reinstatement
🔊 *"First — what was the name of the place you worked?"* → capture
🔊 *"Got it. And what was your role there?"* → capture
🔊 *"Thanks. Roughly when did you start — even just a year is fine."* → capture
*(Layer 2 "got it"/"thanks" between each. Confirms receipt, never interprets.)*

### Free narrative — DO NOT INTERRUPT
🔊 *"Okay. Now, in your own words — what happened? Tell it however it comes to you. Don't worry about order or dates. I won't interrupt — just talk, and tap done when you're finished."*
→ worker speaks freely, any length
- Assistant is **fully silent** through the entire narrative. No "mm-hm," no follow-up. Interruption suppresses recall — this is the 25–40% lift phase.
- Continuous speech-to-text, autosaving.
- Worker controls the end (tap/"done"/confirmed long pause: *"Are you finished, or just thinking? No rush."*). Never a timeout that cuts them off.

### Factual recall aids — optional, SAFE Screen 3
🔊 *"That's helpful. A few optional questions — sometimes they bring more back. Skip any of them."*
🔊 *"As best you remember — what happened first, then what came next?"* → speak/skip
🔊 *"Was anyone else there? Names or roles are both fine."* → speak/skip
🔊 *"Was anything written down or sent — emails, texts, letters?"* → speak/skip
🔊 *"Was there a specific moment that stands out?"* → speak/skip
- **SAFETY RULE (matches shipped flow):** factual anchors only — sequence, people, documents, standout *events*. NEVER "what were you feeling," NEVER sensory re-experiencing. No clinician in the room.
- "skip" or silence both advance, zero pressure.

### Document anchoring (voice narrates, touch performs)
🔊 *"Last part. If you have documents — pay stubs, schedules, texts, a termination letter — you can upload them on the screen. A photo of paper works too. Don't have something? Just add what you have."*

### Close — no-limbo
🔊 *"That's it — your story is organized. You answered once, and you're done. You won't need to repeat any of this."*

---

## Three rules underneath the whole flow

1. **Fixed prompts, warm pacing — never improvise substance.** The assistant reads vetted questions and adds only Layer-2 glue. It never invents a follow-up or reacts to answer content. Interface, not agent.

2. **Multimodal always.** Every voice beat has a visible text/touch equivalent. A worker in a noisy shelter, with a speech difference, or who simply won't speak aloud completes the identical flow by typing. Voice is layered on top, never required.

3. **Confirmation, never interpretation.** "Got it" / reading back what was captured = fine. "So it sounds like you were retaliated against" = forbidden. Characterizing legal merit is the attorney's job; the intake organizes and reflects, never concludes.

---

## Where generative AI CAN help (safely)

Not live, not at the worker. *After* capture: AI organizes the captured narrative into the timeline/packet — "organize and reflect" on already-captured facts, reviewable, not improvised at a vulnerable person in real time. That's where the model earns its keep without touching the worker live.

---

## Metrics

Same pairing as the text flow: **richness** (narrative length + follow-ups answered, counts only, no PII) + **completion rate**. A/B voice-on vs. text-only to measure whether voice lifts richness/completion for the fire-displaced population specifically — the group it's designed to help. If completion drops, voice is adding friction, not removing it.

---

## Engineering review — resolve BEFORE building (added during spec archive)

The design is sound; these three implementation decisions must be settled before a build session, or they become bugs/liabilities:

1. **Layer 2 must be a FIXED phrase library, not live model output.** "Bounded glue" generated by an LLM is still a generative surface that can drift. Implement Layer 2 as a small, **vetted constant array** of acknowledgment/pacing phrases, selected deterministically (rotation/random from the approved list). Result: **zero live generation reaches the worker** — both layers are fixed and reviewable. This is what makes the UPL review airtight rather than mostly-airtight.

2. **Transcript confirm-and-edit is mandatory (STT accuracy).** Speech-to-text mangles names, dates, and accented/stressed speech — exactly the fire-displaced population this serves. The worker must **see the transcribed text and be able to correct it** before it's saved into the record. Store the (worker-confirmed) transcript as editable text; never treat raw STT as ground truth. An inaccurate "record" is worse than a plain form.

3. **Voice/audio privacy decision (counsel + Privacy Policy).** Capturing voice introduces audio/biometric data. Default to **transcribe-and-discard: do not store raw audio.** Add a Privacy Policy line covering voice processing and the STT provider, and confirm the provider's terms don't train on or retain the audio. Same review family as the referral-service question — route to counsel. Note the STT provider choice itself (browser Web Speech API vs. cloud) has privacy + quality + cost tradeoffs to evaluate.

**Accessibility upside to keep in view:** voice output (TTS) of the fixed prompts is a genuine inclusion win for low-literacy or low-vision workers — frame it as accessibility, not just a nicety. The multimodal rule already covers the inverse (can't/won't speak → type).
