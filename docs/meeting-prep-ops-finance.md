# one3seven — Meeting Prep: Payments, Financing & Structure

*Prep for the ops/finance meeting. Grounded in `docs/stripe-setup-guide.md`,
`docs/billing-and-commissions.md`, `docs/org-hiring-roadmap.md`. Figures are live pricing;
estimates are marked. Last updated 2026-07-23.*

---

## 0. Read this first — the thing not on the agenda

**The founder agreement and IP assignment with Tad are still unsigned.**

This sits *underneath* three agenda items (financing, structure, expectations). No investor funds a
company where two founders have no written equity split and the IP isn't assigned to the entity —
and a financing conversation held before it is signed is a conversation that can't conclude.

If only one thing gets decided in this meeting, make it a **signing date with a real attorney.**
Everything below assumes that's happening.

---

## 1. Stripe — where it actually stands

**Nothing is live.** No Stripe account, no products, no price IDs. The chain is:

> entity (One3Seven Ventures LLC, CA formation pending) → EIN *(have)* → business bank account →
> Stripe account → 3 products/prices → price IDs into Vercel + Supabase → deploy 2 edge functions

**The risk nobody has flagged yet:** even once Stripe is set up, **checkout will not work correctly.**
The backend edge functions still reference **legacy tier names that no longer exist**
(`STRIPE_PRICE_SOLO`, `PRACTICE_PLUS`, `FIRM_PLUS`) and **never wire Surge at all.** Your live tiers are
practice / firm / surge. Until that's reconciled, a firm that pays could land on the wrong plan or fail
checkout outright. Same stale names also appear in the wage-exposure feature gate — one reconciliation pass
fixes both. It's a small, contained code change, but it is the difference between "Stripe is set up" and
"a firm can actually pay."

**What this costs you (Firm plan, $549/mo):**

| Line | Amount |
|---|---:|
| Firm pays | $549.00 |
| − Stripe (2.9% + $0.30) | ~$16.22 |
| − Rep commission (20%) | $109.80 |
| − AI + infra (COGS, *estimate*) | ~$30–60 |
| **= Contribution margin** | **~$363–393 (66–72%)** |

**Decisions to leave the room with:**
1. **Who owns entity + bank account, with a date.** This is the gate on everything else.
2. **Who owns the Stripe account setup** — Jessica is the natural owner (payments).
3. **Commission on gross or net-of-Stripe?** 20% of $549 = $109.80 vs 20% of $532.78 = $106.56. Small per
   firm, but it must be written down before a rep sells anything, or it becomes a dispute later.
4. **Test mode only until a real firm is ready.** Do not flip live early.

---

## 2. ACH — the strategy, and the friction

**Why it matters.** ACH is ~0.8% **capped at $5**. Cards are 2.9% + $0.30, uncapped.

| Firm annual ($6,588) | Fee |
|---|---:|
| Card | ~$191/yr |
| **ACH (annual, one pull)** | **~$5/yr** |

That's ~$186 saved per firm per year — at 50 firms, ~$9,300/yr straight to margin. The lever is
**annual + ACH**, because one annual charge hits the $5 cap *once* instead of twelve times.

**The friction — the likely "ACH problem":**

- **Verification is the conversion killer.** Stripe ACH needs either microdeposits (1–2 days, heavy
  drop-off) or Financial Connections (instant, but the firm must log into its bank through a vendor
  screen). **Law firms routinely refuse that.** This, not the fee, is what kills ACH adoption in B2B legal.
- **ACH fails late.** Cards decline instantly; ACH can return days later (R01 insufficient funds, R29
  unauthorized) — *after* you've already unlocked the plan. Cards fail before delivery; ACH fails after.
- **Pull vs push.** ACH debit requires the firm to authorize you to *pull* from its account. Many firms'
  finance policy only permits *pushing* payment against an invoice.
- **You can't receive ACH at all** until the entity + business bank account exist.

**Recommendation for the first cohort:** don't force ACH pull. **Invoice annual firms and let them push
ACH or send a check.** Volume is low and every relationship is hands-on, so the automation isn't worth the
drop-off. Automate ACH pull once there are enough firms that invoicing is a chore.

**Card surcharge** (disclosed, capped at your cost — "ACH/wire free · card +3%") is CA-legal but must follow
disclosure and card-network rules. **Herman is the right person to pressure-test this** — merchant
services is his background.

---

## 3. Facebook — the channel is working; the integration is where the risk is

**What's true today:** organic Facebook is your only proven acquisition channel. It produced a real
worker who consented and asked to be prepared for a consultation. That's signal worth taking seriously.

**Two non-obvious risks before anyone installs a pixel or buys ads:**

1. **Employment is a Meta "Special Ad Category."** Ads about employment situations get classified there,
   which *strips* targeting — no detailed interest targeting, restricted age/gender, wider radius
   minimums. Plan for organic and referral to outperform paid, and don't budget as if you can target
   precisely.

2. **The pixel is the real exposure.** A tracking pixel on pages about being wronged at work sends
   *sensitive, legally-adjacent browsing behavior* to Meta. That exact pattern is the basis of the current
   wave of CIPA / wiretapping class actions against websites. **You would be handing plaintiff-side
   employment firms — your own customers — a claim against you.** The irony would not be lost on them.

**Recommendation:** stay organic for now. If you later want a pixel or ads: counsel first, a real consent
banner, and never transmit identifiable events from worker pages. Your current cookieless first-party
`web_events` table already gives you the funnel without the liability.

---

## 4. Financing — what to be ready for

**The honest position:** pre-revenue, pre-seed. Zero paying firms, one real worker, one builder. That
gets priced on **team + wedge + a defensible position**, not on metrics. Anyone asking for traction
multiples is the wrong conversation.

**What the money is actually for** — the roadmap is unambiguous: the **founding/lead engineer is the
first dollar of the raise.** The company's #1 structural risk is that the founder is the sole builder.
Sales capacity is not the constraint; engineering is.

**The tension to pre-empt (likely underneath Tad's concerns):**

> Reps earn **20% recurring**. Founders take **no per-transaction cut** — their upside is equity.
> Tad is **both** co-founder *and* Head of Sales.

So if Tad personally closes the first ten firms, does he earn commission on them, or is he compensated
purely in equity? **The current written model says equity only.** He has no salary and no draw. That is a
real, predictable friction point, and it is far cheaper to resolve now, in the founder agreement, than
after he's closed revenue and feels it.

Options to have ready: (a) equity only, per current doc; (b) equity + commission on deals he personally
closes, at rep rate; (c) equity + a deferred salary that switches on at a revenue trigger. **Pick one and
write it down.**

**Financing paths, honestly ranked:**
1. **First paying firms** — 3 firms × $549 = $1,647/mo. Real validation, but nowhere near an engineer's salary.
2. **Friends & family / angel on a SAFE** — fastest, needs the entity + founder agreement signed.
3. **Institutional pre-seed** — possible on the wedge, but not before the agreement, entity, and a
   repeatable pilot→paid conversion.
4. **Revenue-based financing** — not applicable; there's no revenue to lend against.

---

## 5. Structure — owners and segmented dates

**Who owns what (proposed — confirm in the room):**

| Person | Department | Owns |
|---|---|---|
| **Victoria** | CEO · Product | The engine, counsel, fundraising. *Explicitly not sales ops.* |
| **Tad** | Co-Founder · Sales | Founding-firm pipeline and close |
| **Herman** | Sales & Marketing | Script, training, presentation, rep onboarding |
| **Jessica** | RevOps · Payments | Stripe, invoicing, billing ops, commission payouts, bookkeeping |
| **Chris** | Sales Rep | Runs Herman's playbook |
| **Leilani** | Advisor | — |

**Segmented targets:**

| Window | Milestone | Owner |
|---|---|---|
| **Days 1–30** | Founder + IP agreement signed with an attorney | Victoria · Tad |
| | Entity active + business bank account open | Victoria · Jessica |
| | Sales script + objection sheet v1 written | Herman |
| | Tier/checkout code reconciliation done | Victoria |
| **Days 31–60** | Stripe live in test → verified end-to-end | Jessica · Victoria |
| | Sales presentation built + rep training run | Herman · Tad |
| | Written rep commission agreement signed (before any selling) | Victoria · Jessica |
| | 5 firm demos booked | Tad · Chris |
| **Days 61–90** | First 3 pilots converted to paid | Tad |
| | First real billing cycle collected + commission paid | Jessica |
| | Lead engineer search opened | Victoria |

---

## 6. Expectations — say this part out loud

1. **Engineering is the constraint, not sales.** One builder, no CS hire. If the pipeline fills faster than
   the product can absorb, the pilots fail and the reputation cost lands on the firms you most want.
2. **Target a small founding cohort — 3 to 5 firms, hands-on.** Not volume. Every early firm should be
   onboarded personally. Volume is a Phase-2 conversation.
3. **Nothing is billed until an agreement is signed** — founder agreement, then rep commission agreements,
   then checkout. In that order. California requires the commission agreement in writing before sales
   activity.
4. **No one gets paid commission during the free 7-day pilot.** Commission starts the month a firm converts.
5. **The guardrails are not negotiable under sales pressure.** No fee-splitting, no per-referral pay, no
   percentage of winnings, no promising outcomes. If a firm asks for it, the answer is no — that constraint
   *is* the moat.
6. **Realistic 90-day success:** agreements signed, entity + Stripe live, 3 paid pilots, first commission
   paid, engineer search open. Not "$10K MRR."

---

## Open questions to resolve in the room

- What specifically is **the ACH problem** as Herman/Jessica see it — verification friction, settlement
  timing, no bank account yet, or something already encountered?
- What does **Facebook integration** mean here — paid ads, pixel/tracking, FB login for workers, or
  scaling the organic posting that's already working?
- What exactly are **Tad's financing concerns** — dilution, his own compensation, the raise amount, or
  runway?
