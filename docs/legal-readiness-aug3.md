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

---

## 🆕 Added 2026-08-09 — Steno conflict + ownership-fact prep

Victoria is currently employed at **Steno**, a legal-tech company (court reporting / litigation
services / AI transcript products), while building one3seven. This is now **counsel question #1,
alongside the Tad founder+IP agreement** — both are really the same question: who owns one3seven.

### 🟢 Do now, without an attorney (fact-gathering, not decisions)
- [ ] **Read Victoria's own Steno employment/confidentiality/invention-assignment agreement** before
  the meeting — know what it actually says about scope of assignment, not for the first time in the room. (V)
- [ ] **Pull the real formation documents** for "One3Seven Ventures LLC" — only evidence on file today is
  a Sentry org slug; bring the actual filed entity paperwork. (V)
- [ ] **Ask Tad his current employer/conflict status directly** — unknown today, costs nothing to close. (V)
- [ ] **Bring `docs/founder-agreement-DRAFT.md` and `docs/ip-assignment-DRAFT.md`** as a starting point for
  counsel to mark up, not a finished answer. (V)
- [ ] **Get Alexia's one-line written consent** for processing her employment records — her SSN/DOB/DL
  currently sit in the prod DB from the OCR'd personnel file. (V)
- [ ] **Redact or flag that SSN/DOB/DL page** in the prod DB rather than leaving it as-is any longer than
  necessary. (V/ENG)

### Standing hygiene (already in force — hold the line until sign-off)
- Steno equipment/accounts/network/time: never used for one3seven. Personal hardware only.
- Steno internal information (customers, roadmap, pricing, code, docs): never used in any one3seven
  artifact.
- Steno is never a reference point, comparison, or example in one3seven work product.
- No soliciting Steno customers/colleagues while employed.
- Preserve, don't delete — if a dispute is ever reasonably anticipated, litigation-hold immediately.

### 🔴 Add to the attorney-only list
- [ ] **CA Labor Code §2870 analysis** on Victoria's Steno invention-assignment clause — side-project
  protection only holds if own time, no employer equipment/info, AND the work doesn't relate to Steno's
  business or anticipated R&D. Steno = legal-tech AI; one3seven = legal-tech AI — the "relates to" prong
  is the real gray zone. (A)
- [ ] **Disclosure/exit strategy** re: Steno employment once the §2870 analysis lands. (A)
- [ ] **Litigation-hold basics** — if a Steno dispute is ever reasonably anticipated, what needs to be
  preserved and how. (A)

### ✅ Done 2026-08-09 — public-site exposure sweep
19 static pages under `public/` (sales-doctrine "never-say" scripts, unreleased pricing math,
internal financial planning) were reachable by anyone with the URL despite being labeled
internal/confidential — `robots noindex` blocks search engines, not direct access. Moved to
`docs/internal-training/` (not served by the live site) rather than deleted. Also reconciled the
founder's insurance-settlement story to one consistent phrase ("settled for the policy limit")
across the two public pages that tell it. Left `one3seven.com/fire-demo` untouched — it's a
memorized, spoken-aloud sales link Tad actively uses on calls, not an accidental leak; worth a
quick look by counsel given it's public and simulates a live settlement/release scenario. Still
open: live re-verification that RLS is actually enabled on the `intakes`/`profiles`/`uploaded_files`
tables in production (blocked today — no Docker for `supabase db dump`, no direct DB password);
prior sessions verified this via a direct `pg_policies` query, just not re-confirmed today.

### Don't do in the meantime
- Don't quote or sell to a real firm — locked "official" pricing is not the same as cleared to quote one.
- Don't flip the damages/exposure counsel gate (`DAMAGES_SURFACING_COUNSEL_APPROVED`).
- Don't sign anything with Tad informally, even a handshake equity split.
- Don't publish new marketing copy beyond what's already doctrine-locked (organize-never-conclude, no
  case/damages language) to "get ahead of it" — that judgment call is exactly what this meeting is for.
