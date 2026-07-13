# Legal Readiness — Before Aug 3 Pilot

**Scanned:** 2026-07-13 · **Pilot target:** Aug 3, 2026 · **Not legal advice** — a founder-level risk
map to make a single focused CA-attorney consult fast and cheap.

**Verdict:** The *product* is legally disciplined (UPL guardrails, verb test, referral language,
disclaimers all strong). The gaps are in **business scaffolding** (contracts, entity, insurance) and
**verifying published privacy claims match reality**. That's standard startup hygiene, not a product
rebuild.

Owners: **V** = Victoria (do now, free) · **T** = Tad (must sign/participate) · **A** = attorney-only ·
**ENG** = code/config verification.

---

## ✅ Done today
- [x] **Removed "founder pricing locked for life"** from the live `/for-firms` page — replaced with a
  reference to a founding-firm agreement. (Was: indefinite, uncapped public promise. — V)

## 🟢 This week — you can do these WITHOUT an attorney (free, immediate)
- [ ] **Delete "California adopted statewide"** from `docs/positioning-one-pager.md` — gov-endorsement
  overclaim; must never reach public copy. (V)
- [ ] **Write Tad a one-page "what you may promise" memo** — he's an authorized agent; a verbal "lifetime
  pricing" from him can bind the company. Cap his authority in writing. (V→T)
- [ ] **Get an E&O / professional-liability insurance quote** (~$3–5K/yr; bind before firm #1). (V)
- [ ] **Verify the 3 published privacy claims are actually TRUE** (they're representations = CCPA/FTC
  exposure if false): (ENG)
  - Anthropic "not used to train" — confirm against your commercial API terms.
  - Supabase "encryption at rest" — confirm the setting is on.
  - "Row-level security on all worker-data tables" — confirm + test cross-account access fails.
- [ ] **CCPA copy fixes** (copy + light code): add a "Your Privacy Choices" footer link; change deletion
  from "promptly" → **45 days**; define the **backup-retention window** (e.g., 30 days); add an explicit
  **"Share with [Firm]" consent checkbox + log** (timestamp + firm id). (V/ENG)
- [ ] **Keep the wage-exposure/damages feature demo-only** — do not ship to production until counsel
  clears the wording. Already gated; just hold the line. (V)

## 🔴 Attorney consult — book ASAP; MUST close before your first paid signature (the real Aug 3 gate)
- [ ] **Founder agreement + IP assignment with Tad** — #1. Without it, ownership of code / the 350-firm
  list / brand is contestable, and everything below (equity, commission, who owns what sells to firm #1)
  depends on it. (A + V + T)
- [ ] **Rep independent-contractor agreement (1099) with Tad** — settles classification AND frames the
  20% commission as pay for selling a subscription, *not* a referral fee. (A + T)
- [ ] **Firm Subscription Agreement + "I agree" gate before Stripe checkout** — today a firm could pay
  with zero governing terms (no liability cap, no data terms, no termination). (A drafts · ENG wires gate)
- [ ] **Pilot / founding-firm order form** — signed acceptance before pilot access; this is where the
  **capped, continuous-subscription-conditioned** founder pricing actually lives (not the webform). (A)
- [ ] **Bless final ToS / Privacy wording** — incl. a **PAGA carve-out** in arbitration and the three
  verified technical claims. (A)
- [ ] **Confirm UPL posture + sign off on the wage-exposure feature copy** before it ever ships. (A)

## 🟡 After the pilot lands (tighten, not blocking)
- [ ] Founder mold-settlement story: counsel review of the exact wording before it goes on the homepage
  (even "settled at the maximum" carries an outcome implication). It is **not currently live**. (A + V)
- [ ] Real security audit / pen test if you ever want to make "verified/audited" claims. (V)
- [ ] Minor product naming polish: rename PDF §9, internal `readiness`/`exposure` fields for clarity. (ENG)

---

## Findings by area (for the attorney)

| Area | Verdict | Top items |
|---|---|---|
| Public marketing copy | **Strong** | Kill "CA adopted statewide" (internal doc); founder-story wording |
| Product / UPL behavior | **Strong** | Keep wage-exposure demo-only until sign-off; naming polish |
| Legal docs & data/privacy | Competent, gaps | Verify 3 tech claims; CCPA (choices link, 45-day, consent log); PAGA carve-out |
| Business / contracts | **Weakest — the real work** | Founder+IP w/ Tad; firm agreement; rep IC; pilot order form; E&O; capped founder pricing |

**Already strong (don't touch):** UPL architecture (jurisdiction/tier/access gates, banned-vocabulary
blocking, worker-facing softening, hard disclaimers) · verb test in public copy · referral language locked
down · flat-subscription model · worker autonomy · RLS isolation · honest ToS (liability cap, CA governing
law, document ownership, children's privacy, no-sale promise).

**The money-saver:** the attorney-only list is one well-prepped consult — not a retainer. This doc is the
prep.
