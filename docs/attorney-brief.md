# one3seven — Attorney Consultation Brief

**Prepared by:** Victoria Ramey, One3Seven Ventures LLC · **Date:** 2026-07-13
**Ask:** One focused consult (not a retainer) to draft a small set of core agreements and bless a few
existing documents, timed before our first paying firm. **Target:** pilot conversions begin ~Aug 3, 2026.
**Ideal counsel:** California business/tech-transactions attorney comfortable with legal-tech, UPL, lawyer-
referral rules, and CCPA/CPRA.

---

## 1. What one3seven is (2 minutes of context)
A software subscription that organizes a worker's scattered employment records into a clean, **source-linked
intake** for a plaintiff-side employment attorney to review. Core discipline, enforced in the product: it
**organizes and reflects — it never concludes, advises, scores, values, predicts, or recommends.** The
attorney makes every legal judgment. Sold as a **flat subscription** to firms (never per-client, never fee-
split). It is **not** a law firm and **not** a lawyer-referral service. Built on Anthropic's Claude.

## 2. What we've already done (so you can focus your time)
- Product/UPL posture reviewed: jurisdiction/tier/access gates on the one sensitive feature (wage
  arithmetic), banned-vocabulary blocking, worker-facing softening, hard disclaimers, verb-tested copy.
- ToS + Privacy are drafted (self-authored) and recently updated (see §4).
- Row-level security verified in code across all worker-data tables (isolation claim is accurate).
- Removed an indefinite "founder pricing locked for life" promise from the public site.
- Froze an unverified "California adopted Anthropic statewide" line in our live call script pending your
  answer (see §5, Q1).

We believe the **product** is disciplined; the gaps we need you for are **contracts, structure, and a few
claims to confirm.**

---

## 3. Documents to DRAFT from scratch (priority order)
1. **Founder Agreement + IP Assignment — Victoria ↔ Tadmor "Tad" Russell.** *This is the anchor; everything
   below depends on it.* Tad is described as co-founder and drives sales. There is currently **no** written
   founder agreement and **no** IP assignment. Need: roles, equity split (we will bring the number), vesting,
   IP assignment of all code/docs/customer list/brand to the LLC (including pre-formation work), non-compete/
   non-solicit, exit/buyout. *Please treat as #1.*
2. **Independent Contractor Agreement — Tad (sales).** Compensation is **20% recurring commission** on firm
   subscription revenue. Please review specifically for **referral-fee-adjacent risk** and frame it clearly
   as pay for selling/supporting a software subscription — not for referring clients. Include 1099 status,
   clawback, termination, non-solicit.
3. **Firm Subscription Agreement + checkout acceptance gate.** Today a firm could pay via Stripe with no
   master terms. Need: tier/usage, billing/term, **limitation of liability**, data/confidentiality, IP,
   termination, CA governing law/venue, and an explicit "I agree" gate before payment.
4. **Pilot / Founding-Firm Order Form.** This is where **capped founder pricing** now lives (after we removed
   the indefinite public promise). Need it to define: pilot term (30 days from first real intake), that the
   pilot creates no obligation to convert, and founder pricing that is **cohort-capped and conditioned on
   continuous subscription** (we will bring the cohort size and sunset date to decide with you).

## 4. Documents to REVIEW / BLESS (already drafted)
5. **Terms of Service** and **Privacy Policy** (copy lives in `src/app/constants/legalContent.ts`; live at
   `/terms` and `/privacy`). Recently updated: **45-day CCPA deletion window**, defined backup-retention
   window, **opt-out / limit-sensitive-PI / authorized-agent** rights, CPRA "sharing" clarification, and a
   **"Your Privacy Choices"** footer link. Please confirm: the **PAGA carve-out** in the arbitration clause,
   the liability cap, and that our technical claims (below) are stated defensibly.

## 5. Decision questions for counsel (judgment calls, not just review)
- **Q1 — "California adopted Anthropic statewide" line.** Is there a real, citable factual basis for *any*
  version of this? If yes, what is the **narrowest defensible phrasing**? If no, we purge it from
  `caller-brief.md` and `firm-page-copy-vetted.md` (already frozen in the call script). Our own copy rules
  say to avoid it, but two internal docs say it's fine — we need this settled.
- **Q2 — Wage-exposure feature.** Confirm it must stay **demo-only** until you clear the exact wording, and
  tell us what disclaimer/gating you require before it could ship. (Currently gated to demo.)
- **Q3 — Founder testimonial.** A true, lived mold-insurance-claim origin story (not currently published).
  What phrasing keeps it clear of an outcome/causation claim before we put it on the homepage?

## 6. Quick lookups (not deep legal judgment — batch these)
- **Q4 — Anthropic "not used to train" claim (~15 min).** Our Privacy Policy states Anthropic does not use
  uploaded documents to train its models under its commercial API terms. Please confirm this against our
  **actual account-level Anthropic terms** (a lookup, not a legal analysis) so the published claim is backed.

## 7. What we will bring to the meeting (founder decisions)
- Equity split with Tad (for the founder agreement).
- Founder-cohort **size cap and sunset date** (for the order form).
- Confirmation of our Anthropic account tier/terms and Supabase configuration.

## 8. Materials provided
- Live pages: `/terms`, `/privacy`, `/for-firms`, `/demo` (sample packet).
- `docs/legal-readiness-aug3.md` — the full risk scan + owners.
- `docs/tad-sales-authority-memo.md` — interim authority limits for Tad.
- ToS/Privacy source: `src/app/constants/legalContent.ts`.
- This brief.

## 9. Sequence we're requesting
**Before first paid signature (hard gate):** #1 Founder+IP, #2 Rep IC, #3 Firm Subscription + gate, #4 Pilot
order form, #5 ToS/Privacy blessing, Q1 + Q2 + Q4. **After:** Q3 (testimonial). Start with #1 — it is the
anchor the rest depends on.
