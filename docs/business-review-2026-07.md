# one3seven — Honest Business Review (2026-07-16)

*A candid "where we actually are" pass across workflow, product, pricing, strategy, team, and risk — written to
catch what's been missed, not to cheerlead. Grounded in this session's code audit, pricing, and data-model
review.*

---

## The one-sentence truth
**You have a real, working product and a beautiful pitch — but the machine that turns "yes" into money and the
few things that unblock everything else are not closed yet.** The work has drifted toward polishing the story
faster than closing the fundamentals.

## The core gap: you can't actually take money yet
- **Stripe products/prices don't exist.** If a firm said "I'll pay" tomorrow, **there is no live way to charge
  them.** The billing story, the tiers, the split math — all built in decks and docs — but the actual
  collect-a-dollar path is unwired. This is the single most important unglamorous fix.
- **Your premium feature is gated so no paying tier can buy it.** The wage-exposure/damages upsell is locked to
  `enterprise` only (a plan-id mismatch: the gate checks `practice_plus`/`firm_plus`, which don't exist). So
  even after Stripe is live, Firm/Surge firms can't buy your differentiator.
- **The demo depends on hand-editing the database.** Showing the wage-exposure "wow" requires manually changing
  a firm's `plan_id` in Supabase and reverting after — fragile for a live investor demo.

## Fix-first (the blockers that unlock everything else — ranked)
1. **Engage one fractional startup attorney.** This single action unblocks: the founder + IP agreement, the
   entity/EIN confirmation, the wage-exposure/monetization line sign-offs, the insurance questions, and the
   privacy posture. It's the highest-leverage move you can make this month.
2. **Create the 3 Stripe products + wire the price IDs.** ~Half a day. Without it, "first paying firm" is
   literally impossible.
3. **Confirm the entity is actually formed + in good standing + EIN.** A 10-minute lookup that currently blocks
   binding insurance, signing clean contracts, and the raise. (The deck still says "formed" — verify it.)
4. **Hire the founding engineer.** The founder is the sole builder; every product change is single-threaded
   through her. This is the constraint under everything product-side.
5. **Fix the wage-exposure tier gate** (with counsel sign-off, since it's counsel-gated) so paying firms can
   buy the premium.

---

## Workflow & product — what we missed
- **The FIRM activation path is under-built.** Most product energy is worker-side, but the *buyer* is the firm.
  The path from "firm interested" → "firm sees value on a real intake" → "firm pays" has friction and no clear
  aha moment. **You already capture `crm_minutes_saved` but never show it back to the firm.** Building the
  firm-facing "here's the time you saved" moment is probably the highest-ROI product change for conversion.
- **Intake completion is unmeasured (as far as I can see).** Workers arrive low-energy with a shoebox — do they
  finish? The top of your funnel is intake completion; a leaky top silently kills everything downstream.
  Instrument it and reduce abandonment.
- **Two intake paths exist** (`GuidedIntakeScreen` + `WorkerStoryIntakeScreen`). Maintaining both is complexity
  for a solo builder — decide which wins, or clearly route between them.
- **The worker-first vision isn't what actually ships today.** The "worker sends to firms they choose" network
  is counsel-gated OFF, so today the live product is **firm-code-directed** (firm invites worker) — closer to
  "firm intake software" than the worker-first story. That's fine as a phase-1 distribution reality, but be
  honest internally about the gap between the pitch and the shippable product.
- **A proper demo mode** (a safe flag) would beat manual DB edits for showing gated features live.

## Pricing — what we missed
- **The prices are unvalidated guesses.** $249/$549/$1,490 has been reinforced across five decks, but **zero
  firms have paid.** Treat the first 3 pilots as a *pricing experiment*, not a rollout — test willingness to
  pay; you may be leaving money on the table or mis-shaped.
- **The 7-day pilot is probably too short** to reach first value — an employment intake cycle may not complete
  in a week. Consider "pilot until first completed intake" or 14–30 days, matched to time-to-value.
- **No annual discount or per-seat expansion pricing is actually built** — the land-and-expand levers are
  theoretical. And the **`crm_minutes_saved` ROI metric isn't used to price** — your best pricing argument is
  sitting unused.
- **20% recurring rep commission forever** is generous; model what it does to margin at scale, and pin
  gross-vs-net before it's in signed rep agreements.

## Strategy & go-to-market — what we missed
- **The wedge may still be too broad.** "CA plaintiff employment firms" is 1,000–3,000 firms. For a
  pre-revenue solo-builder, even that is wide. **Pick one narrow niche** (a single claim type, or one city/bar
  section) and dominate it — 3 firms who love you beat 91 who kind-of know you.
- **Founder-led sales is being delegated too early.** You have a sales team (Tad, Herman, Chris) but the
  founder holds the lived-experience story that converts, and pre-PMF customer conversations are where you
  *learn*. Even if Victoria wants to stay behind the scenes, she should be *in* the first sales calls — the
  learning is the point, not just the close.
- **Keep the second vertical and adjacent ventures parked.** Insurance (validation-only), Legal Fleet, Journey
  School — all classic focus-killers for a pre-revenue solo-builder. Discipline here is a strength.

## Team & ops — what we missed
- **The org is optimized to sell something that can't yet be bought or built further.** Heavy sales capacity,
  no engineer, no live payments. Rebalance toward the constraint (engineering + infra), not more selling.
- **Founder + IP agreement: drafts now exist (progress) but unsigned.** Still the #1 non-code risk.
- **Counsel not engaged, insurance not bound, entity unconfirmed** — a cluster of "almost done" items that each
  block real things. Close the cluster.

## Risk & blind spots
- **Security is real but incomplete** — RLS is strong, but no pen test, no MFA, no written incident-response
  plan, and you hold highly sensitive PII. A breach pre-revenue would be existential. Bind the cyber insurance
  (mind the retro date) and write the IR plan.
- **CCPA/privacy** — you hold CA residents' sensitive data; confirm the privacy policy, data-processing terms,
  and breach process with counsel.
- **55 TypeScript errors + one data-loss bug (now fixed)** — the codebase is defensive and builds clean, but
  the type debt will eventually bite a solo builder.

## Where the prep over-indexed on story vs. machine (owning it)
Much of the recent work — billing deck, journey deck, org deck, agenda, worker deck, monetization map — is
**pitch and strategy polish.** Valuable, but the revenue-gating blockers (Stripe, counsel, entity, engineer)
are operational and were under-pushed. The honest ranking: **before another slide, close Stripe + counsel +
entity + the engineer hire.** The pricing numbers in those decks are also unvalidated — hold them loosely.

---

## The next 5 moves (in order)
1. **Engage a fractional startup attorney** (unblocks founder agreement, entity, monetization/UPL sign-offs,
   insurance, privacy).
2. **Create the Stripe products** so you can actually charge a firm.
3. **Confirm entity + EIN + good standing.**
4. **Start the founding-engineer hire.**
5. **Run the first 3 pilots as a pricing + value experiment** — Victoria in the room — and build the firm-facing
   "time you saved" moment to drive conversion.

*Everything else — more features, more decks, the second vertical — waits behind these five.*
