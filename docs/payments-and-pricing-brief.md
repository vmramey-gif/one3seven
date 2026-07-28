# one3seven — Payments Strategy & Pricing Push

*For the ops/finance meeting. Written for an audience that knows merchant services — Herman and
Jessica have 20 years in POS, so this assumes interchange, downgrades, and surcharge rules are
familiar ground. Where their current knowledge beats mine (network caps change), defer to them.
Last updated 2026-07-23.*

---

# PART A — Why Stripe, and why ACH/wire alone can't carry it

## What Stripe actually does for us (it isn't "a card rail")

If Stripe were only processing cards, it would be replaceable. It isn't, because it's doing four jobs:

1. **It's the subscription engine.** Recurring billing, proration, card-on-file tokenization, automatic
   retry/dunning on failures, invoice generation. Building that in-house is months of work.
2. **The webhook is our access control.** Stripe fires → our function flips `subscriptions.plan_id` →
   the firm's features unlock. Payment state *is* entitlement state. Without it, a human manually
   toggles every firm's plan and every renewal.
3. **PCI scope goes to near-zero.** Hosted Checkout means one3seven never touches a card number. Taking
   card data ourselves means SAQ D — a compliance burden a one-builder company should never carry.
4. **Account Updater.** Expiring/reissued cards get updated automatically, so subscriptions don't churn
   on a card reissue. That's silent retention.

## Why we can't just run ACH/wire

| | Card | ACH | Wire |
|---|---|---|---|
| Real-time approval | **Yes** | No | No |
| Self-serve signup | **Yes, ~2 min** | Days | Manual |
| Automatable recurring | **Yes** | With mandate + verification | **No** — payer initiates |
| When it fails | **Before** delivery | 2–5 days **after** | n/a |
| Cost to payer | $0 | $0 | **$15–35** |

Five reasons ACH/wire can't be the only option:

1. **No instant activation.** A firm decides on a demo call and wants in *now*. Card auth is real-time;
   ACH settles in days with no good-funds guarantee. Momentum is the thing you lose.
2. **Failure timing is backwards.** A card declines *before* you deliver. An ACH return (R01 NSF, R29
   unauthorized) lands days *after* you've already unlocked the plan. You eat the delivery.
3. **Verification is the real killer.** Stripe ACH needs microdeposits (1–2 days, heavy drop-off) or
   Financial Connections — which asks the firm to **log into its bank inside a vendor screen.** Law firms
   routinely refuse. This, far more than the fee, is why B2B ACH adoption stalls.
4. **Wire costs the payer.** Nobody wires $549 every month to save *us* money. Wire only makes sense on a
   large annual or enterprise ticket.
5. **Reconciliation is manual.** Wires and checks have to be matched to accounts by a person. Fine at 5
   firms; a job at 50.

**The frame for the room:** cards are the **sales instrument** — they close deals fast and self-serve.
ACH/wire are the **savings instrument** — they win on large annual tickets. We want both, each pointed
at what it's good at. This isn't card-vs-ACH; it's *which rail for which ticket*.

---

# PART B — Maneuvering on card cost

## First, the honest read on flat-rate

Stripe's 2.9% + $0.30 is a **blended flat rate**, and Herman/Jessica will spot the arbitrage immediately:

- On a **regulated debit** card (Durbin-capped ~0.05% + $0.21), flat rate is a **terrible** deal.
- On a **commercial/corporate credit** card (interchange ~2.5–2.95% + assessments + markup), flat rate is
  roughly **at-cost or better** — especially on Amex, where Stripe charges the same 2.9% that would
  otherwise cost more.

**Law firms pay with business credit cards, not regulated debit.** So flat-rate is actually *fine to
favorable* for our mix today. The usual "get off flat rate onto interchange-plus" advice **does not
apply yet** — and it's worth saying that out loud, because it's counterintuitive and it shows we did the
math rather than repeating a rule of thumb.

## The lever that matters at volume: Level 2 / Level 3 data

Commercial and purchasing cards **downgrade** to expensive interchange when enhanced data isn't passed.
Passing **Level 2** (tax amount, customer/PO code) and **Level 3** (line-item detail) can pull commercial
interchange down meaningfully — commonly in the ~0.5–1.0% range.

**The catch, and it's the whole point:** on a **flat 2.9%**, L2/L3 saves us **nothing** — we pay the same
rate regardless of what interchange actually costs. Interchange optimization only pays once we're on
**interchange-plus**, where we pay actual cost + markup.

So the sequencing is:

> **Now:** flat rate. Simple, no volume, no negotiating leverage, and our card mix makes it fair.
> **Later (once annual card volume is real):** move to interchange-plus **and** pass L2/L3 data.
> Doing either alone leaves money on the table; doing both is where B2B card savings actually live.

That's the answer to "how do we keep taking cards without paying so much" — the savings are real, but
they unlock at volume, not on day one.

## Surcharge vs. discount — take the discount

Both get to the same economics. They do **not** carry the same regulatory surface.

- **Surcharging** is legal in CA (post-*Italian Colors v. Harris*), but: disclosed at entry and at point
  of sale, **capped at your actual cost of acceptance**, **credit only — never debit or prepaid**, card
  network caps apply, and you must **notify the networks and your acquirer in advance**. Herman and
  Jessica will know the current caps better than any doc — ask them, don't assume.
- **Cash/ACH discounting** posts one list price and offers a discount for paying by ACH/check/wire.
  Networks and state regulators are markedly friendlier to discounts than to surcharges.

**Recommendation: dual pricing, structured as a discount.** Publish the card price as list, and show
"pay annually by ACH and save X." Identical margin outcome, far less compliance exposure, and it reads
as a *reward* to the firm rather than a *penalty* — which matters when you're asking a law firm to trust
you.

## The single biggest lever we already control: annual billing

| Firm plan | Fee |
|---|---:|
| Monthly by card ($549 × 12) | ~**$195/yr** |
| Annual by card (one charge) | ~**$191/yr** |
| **Annual by ACH** | **~$5/yr** (0.8% capped at $5) |

Annual-by-ACH is ~**$186/firm/year** saved. At 50 firms that's ~**$9,300/yr** of pure margin. The $0.30
fixed fee also becomes irrelevant on a large annual ticket (0.002% on a Surge year) versus meaningful on
twelve small ones.

**So the play is:** accept cards to close, then *incentivize* annual-by-ACH with a real discount. The
discount can be worth more than the fee saved and still net positive, because annual prepay also buys
retention and cash flow.

## Practical recommendation for the first cohort

Low volume, every relationship hands-on — so don't over-engineer:

1. **Cards via Stripe Checkout** for anyone who wants to self-serve. Keep flat rate.
2. **Invoice annual firms** and let them **push ACH** or send a check. Skips Financial Connections
   entirely — no bank-login objection, no microdeposit drop-off.
3. **Wire only** for Surge/enterprise. Ask the bank to waive **incoming** wire fees.
4. Revisit interchange-plus + L2/L3 when annual card volume justifies the conversation with Stripe.

---

# PART C — Pricing: we are badly underpriced

## What we charge per intake today

| Tier | Price | Intakes | **Per intake** |
|---|---:|---:|---:|
| Practice | $249/mo | 20 | **$12.45** |
| Firm | $549/mo | 60 | **$9.15** |
| Surge | $1,490/mo (annual) | unlimited | → approaches $0 |

## What it replaces

Each intake removes roughly **2–3 hours** of unbillable sorting. Even valued at a *paralegal's* loaded
cost (~$40/hr), that's **$80–120 of labor per intake.** Valued at an attorney's rate, multiples of that.

> **We are selling something that costs the firm $80–120 to do by hand, for $9–12.**

That is not a discount, it's a mispricing — and it actively hurts the sale. At $9/intake the product
reads like a utility. Legal buyers do not believe a tool that removes 40–60 hours a month costs less than
their coffee budget; a too-low price creates doubt about whether it works.

## What the market already pays

| Comparable | Cost |
|---|---|
| Clio Manage | ~$99–139/user/mo |
| Clio Grow (intake/CRM) | +~$59–99/user/mo |
| Filevine / Litify | ~$100–200/user/mo, enterprise |
| Outsourced legal intake / answering | $300–1,500+/mo |
| Part-time intake paralegal | **$2,500–4,000/mo loaded** |

A 5-seat firm **already spends $500–1,200/mo on Clio alone.** We're asking $549 for the thing that
removes the most painful, least billable hours in the building.

## Proposed list pricing

| Tier | Now | **Proposed** | Intakes | Seats | Per intake |
|---|---:|---:|---:|---:|---:|
| **Practice** | $249/mo | **$499/mo** | 20 | 2 | $24.95 |
| **Firm** | $549/mo | **$1,190/mo** | 60 | 5 | $19.83 |
| **Surge** | $1,490/mo annual | **$2,490/mo billed annually** ($29,880/yr) | fair-use | unlimited | — |

Supporting mechanics:

- **Overage $29/intake** above the cap. Captures volume without ever gating the core feature — consistent
  with the doctrine that tiers sell *volume*, not the fundamental value.
- **Annual prepay = 2 months free** (pay 10, get 12). This is what drives firms onto the annual-ACH rail
  from Part B. Firm annual ≈ **$11,900/yr**.
- **Founding-firm rate: first 5 firms at 50% off, locked 12 months.** This is how we land the cohort
  *without* setting a cheap public list price.
- **Replace "unlimited" on Surge with a fair-use ceiling** (e.g. 250 intakes/mo, then overage). AI COGS
  scales per intake; true unlimited is an uncapped cost exposure on our highest tier.

## Why raising list price now is the low-risk move

It is **far easier to discount from a high list than to raise on firms anchored at $249.** Every founding
firm that signs at $549 makes the eventual increase a renegotiation with your best references.

Our own marketing already says *"the very first intake you don't build by hand covers a month of
one3seven."* At $549 that claim is almost embarrassingly conservative. At $1,190 it is **still true.**
That's the tell that we have room.

**The honest counterpoint:** we have zero paying firms, so pricing power is unproven. The risk of pricing
high isn't lost revenue — we can always discount — it's **slower learning**, because fewer firms engage
at $1,190 and we find out more slowly what converts. The founding-firm rate is the mitigation: high list,
generous first cohort, real data either way.

---

## Decisions to leave the meeting with

1. **Approve or adjust the new list pricing** (and the founding-firm discount structure).
2. **Fair-use ceiling on Surge** instead of true unlimited — yes or no.
3. **Dual pricing as a discount, not a surcharge** — confirm with Herman/Jessica against current network rules.
4. **Surge is $1,490/mo billed annually = $17,880/yr.** The Stripe product must be created at the annual
   total, not $1,490. *(Setup guide has been corrected.)*
5. **Commission on gross or net-of-Stripe** — pin it before any rep sells.
