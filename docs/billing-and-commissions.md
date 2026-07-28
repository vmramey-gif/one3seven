# one3seven — Billing & Commissions Reference

*Internal reference. Figures are drawn from the live pricing in `src/services/billingService.ts` and the
commission terms in the CRM (`CRM_COMMISSIONS`). Numbers marked "estimate" are modeled, not billed. Last
updated 2026-07-16.*

---

## PAGE 1 — How a firm pays, and where the money goes

### How does a firm pay?

A firm pays **one3seven directly, as a software subscription** — the same way it pays for any SaaS tool
(think Clio, Dropbox, or a case-management license). It is **not** paying per case, per lead, or per worker.
That distinction is deliberate: selling cases or leads runs into California attorney-referral and
fee-splitting rules. The firm licenses the software; the worker controls who sees their records.

The three plans:

| Plan | Price | Includes | Billing |
|---|---|---|---|
| **Practice** | **$249/mo** | up to 20 intakes · 2 seats · standard processing | monthly |
| **Firm** | **$549/mo** | up to 60 intakes · 5 seats · priority processing | monthly |
| **Surge** | **$1,490/mo** | unlimited intakes · unlimited seats · dedicated onboarding | **annual only** |

Every firm starts on a **free 7-day pilot** (internal plan id `beta_pilot`) with no card required. They
convert to a paid plan when the pilot ends. The **core value — organizing a worker's records into a
review-ready intake — is never gated**; higher tiers buy *volume* (more intakes, more seats, faster
processing), not the fundamental feature.

### How does Stripe work here?

Stripe is the payment processor — it handles the card, the recurring charge, and the security/compliance so
one3seven never touches raw card numbers. The flow:

1. Firm admin picks a plan in the app and clicks upgrade.
2. Our `create-checkout-session` function asks Stripe to open a **Stripe Checkout** page (hosted by Stripe,
   PCI-compliant). The firm enters its card there.
3. Stripe charges the card and, on success, sends a **webhook** back to one3seven.
4. That webhook maps the Stripe price → our `plan_id` and writes the firm's `subscriptions` row
   (`plan_id` + `status: active`). The moment that row flips, the firm's plan features unlock.
5. Every renewal, Stripe re-charges automatically and re-sends the webhook. If a card fails, Stripe retries
   and marks the subscription `past_due`; if it's never recovered, the plan lapses.

**Money flow:** the firm's payment lands in **one3seven's Stripe account** first. one3seven then pays reps
their commission out of that revenue — reps are **never** paid by the firm directly, and there is no
splitting of any legal fee. Stripe deducts its processing fee (**~2.9% + $0.30 per charge**) before funds
settle to one3seven's bank.

> **Open item:** the Stripe *products/prices* for these three tiers still need to be created in the Stripe
> dashboard and their price IDs wired into checkout. Until then, checkout runs against test/placeholder
> prices. (See memory: "Stripe products still TODO.")

### How much goes to the company, reps, etc.?

Take the **Firm plan ($549/mo)** as the worked example:

| Line | Amount | Note |
|---|---:|---|
| Firm pays (gross) | **$549.00** | |
| − Stripe processing | ~**$16.22** | 2.9% + $0.30 |
| − Rep commission (20%) | **$109.80** | recurring, every active month |
| − AI + infrastructure (COGS) | **~$30–60** | *estimate* — Claude API + Supabase, scales with intake volume |
| **= Company contribution margin** | **~$363–393/mo** | ~66–72% of gross |

Rules that define the split:

- **Reps earn 20% recurring**, paid **every month the firm stays active** — not a one-time close bonus.
  This ties the rep's income to *retention*, so they're motivated to make sure the firm actually uses and
  keeps the product. No salary, no draw, no base.
- **Nothing is paid during the free 7-day pilot.** Commission starts the month the firm converts to paid.
- **Chargebacks / failed payments:** if a firm's payment isn't recovered, that month's commission isn't paid.
- **Founder and co-founder do not take a per-transaction cut** — their upside is equity (and, later, salary),
  not commission. Only sales reps draw the 20%.
- Reps are **independent contractors** of **One3Seven Ventures LLC** (entity formation pending in CA); a
  written commission agreement is signed **before** any sales activity, as California law requires.

> **Decision to pin in the written agreement:** whether the 20% is calculated on **gross** ($549) or on
> **net-of-Stripe** ($532.78). This reference assumes **gross**. It's a small per-firm difference but should
> be stated explicitly so there's never a dispute.

### When is the payment cycle?

- **Practice & Firm:** billed **monthly**, on the calendar anchored to each firm's signup date. Stripe
  re-charges every 30-day cycle automatically.
- **Surge:** billed **annually** (one payment covers 12 months) — this is why it's the "unlimited" tier;
  the annual commitment is what justifies unlimited volume and dedicated onboarding.
- **Rep commissions** are calculated per active firm each billing month and paid out on one3seven's payout
  schedule (define this in the rep agreement — e.g., paid the month following collection, after the
  chargeback window).

### Can there be special / delayed pricing?

Yes — and there already is, by design:

- **Free 7-day pilot** — every firm's default entry. No card, full product, converts to paid at day 7.
- **Founding-firm / pilot pricing** — early firms can be given a locked-in discounted rate or an extended
  pilot as a thank-you for being first. Because a firm's plan is just a `plan_id` on its `subscriptions`
  row, one3seven can grant a specific firm a special rate without changing anything for anyone else.
- **Delayed / deferred start** — a firm can be onboarded now and have billing start later (extended pilot),
  useful for firms that want to trial through a real intake cycle before paying.
- **Annual prepay discount** — a standard lever if you want to reward firms that pay yearly instead of
  monthly (not yet configured, but trivially added as a second Stripe price).

All special pricing should be **recorded per firm** (which firm, what rate, why, for how long) so the
commission math and the revenue reporting stay honest.

---

## PAGE 2 — What pricing looks like through the phase breakdown

one3seven's revenue model **starts as pure subscription and stays subscription-anchored** — new phases *add*
revenue lines on top, they don't replace the core. Every added line is chosen to avoid fee-splitting and
referral-fee exposure: one3seven charges for **software and facilitation**, never for a share of a legal fee.

*Phase 1 figures are live pricing. Phases 2–5 figures are **illustrative planned targets** — directional, not
set, and the marketplace/funding lines stay dark until counsel/regulatory sign-off.*

| Phase | What's live | Pricing (actual / target) | New revenue line | Status |
|---|---|---|---|---|
| **1 — Intake** *(now)* | Organize worker records → review-ready intake | **$249 / $549 / $1,490 per mo** | Firm subscriptions | **Live** |
| **2 — Litigation Ops** | Deadlines, packet ops, deeper workflow | Base tier **+ ~$249/mo** Litigation add-on | Higher revenue per firm | Planned |
| **3 — Expert Marketplace** | Connect firms to vetted experts | **~15% facilitation fee** on the expert engagement (e.g., ~$450 on a $3K expert) | Take-rate on *expert services* (not legal fees) | Counsel-gated |
| **4 — Funding Facilitation** | Introduce firms/workers to litigation-finance partners | **~1–2% referral fee** paid by the funder (e.g., ~$500–1,000 on $50K funded) | Facilitation fee — **referrer, never lender** | Regulation-gated |
| **5 — Expansion** | New verticals (e.g., insurance / public adjusters) | **$249 / $549 / $1,490** tiers × each new vertical | Multiplied subscription base | Validation only |

### Phase-by-phase, in plain terms

- **Phase 1 — Intake (today).** One revenue line: firm subscriptions. Everything above is built on this.
  The job right now is simply to convert pilots to paid Firm/Practice plans and prove retention. Nothing
  fancy — subscription in, contribution margin out.

- **Phase 2 — Litigation Ops.** Same three tiers, but the product now does *more* per firm (organizes
  deadlines to flag for timely review, assembles packets, supports the workflow after intake). That raises
  what a firm will pay and justifies either a price step-up or a paid **add-on** on top of the base plan.
  Still 100% subscription — lowest-risk way to grow revenue per firm.

- **Phase 3 — Expert Marketplace.** one3seven introduces firms to vetted experts and earns a **facilitation
  fee on the expert engagement** — a marketplace take-rate, like any two-sided platform. Critically, this
  fee is on the **expert's service**, not on the legal case or the attorney's fee, which keeps it clear of
  fee-splitting. **Counsel signs off before this goes live.**

- **Phase 4 — Funding Facilitation.** one3seven connects firms/workers with litigation-finance partners and
  earns a **referral/facilitation fee from the funding partner**. one3seven is a **referrer, never a
  lender** — it doesn't loan money or take interest, which keeps it out of lending regulation. This line is
  **gated on regulatory review** and only opens when the structure is cleared.

- **Phase 5 — Expansion.** The same "organize, never conclude" engine points at a new vertical (insurance /
  public adjusters is validation #2). No new pricing invention needed — it's the Phase-1 subscription model
  again, multiplied across more markets. This is how the same machine reaches a much larger revenue base.

### Guardrails that hold across every phase

1. **Core value is never gated** — tiers sell volume, not the fundamental organizing feature.
2. **No fee-splitting, ever** — every revenue line is for software or facilitation, never a share of a
   legal fee.
3. **Counsel-gated lines stay dark** until signed off — the participating-network, expert-marketplace, and
   funding lines do not render or bill until legal clears them (`PARTICIPATING_NETWORK_LIVE = false`, etc.).
4. **Referrer, never lender / never counsel** — one3seven facilitates and organizes; it never gives legal
   advice, never concludes, and never puts its own money into a case.

---

*Sources: `src/services/billingService.ts` (tiers, checkout), `CRM_COMMISSIONS` (rep terms),
`docs/roadmap-phases.md` (phases), `src/app/constants/flags.ts` (counsel gates). COGS figures are estimates
pending real usage data from the first paying firms.*
