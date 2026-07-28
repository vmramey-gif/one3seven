# one3seven — Monetization Map: Clean Passages to Multiply Revenue

*Strategy working doc. Every line here is decoupled from case outcomes and avoids fee-splitting / per-referral
fees on legal matters. "Loophole" = under-used legitimate leverage, not a workaround. Last updated 2026-07-16.*

## The test (applies to every idea)
> **Are we charging for software or a service, fully decoupled from any case outcome — and never sharing a
> legal fee or taking/paying a per-referral fee on a legal matter?** Yes → clean. If the money moves with the
> recovery, is contingent on an outcome, or is a cut per case referred → don't.

Structural note: **entity structuring cannot launder a bright line.** A subsidiary that takes a % of winnings
is still fee-splitting. Entities enable *clean* lines (IP licensing, isolating a certified service) — they
don't convert a prohibited fee into a permitted one.

---

## Part 1 — The assets you actually accumulate (your "data deck")

What the workflow leaves behind, from the code (uploads → text extraction → fact extraction → timeline →
packet → firm review):

| Asset (in the system) | What it is | Why it's valuable | Who would pay |
|---|---|---|---|
| **Organized source-linked record** | The per-worker packet (`intake_summaries`, `timeline_events`) | The finished artifact firms open before the first call | Firms, workers |
| **Structured extracted facts** | `document_facts` (jsonb), `file_text_extractions` | Machine-readable dates/facts/wage data | Firms, other software (API), analytics buyers |
| **Wage / damages engine** | `wageFacts`, `damages_provenance` | Records-based arithmetic + provenance | Firms (premium tier) |
| **Worker relationship + portable record** | Worker account, portability | A worker-owned asset that moves across firms | Workers (premium), firms |
| **Firm relationship + value proof** | Subscriptions, `crm_minutes_saved`, `crm_revenue_intake_count` | You literally measure time saved per firm | Firms (value-based pricing) |
| **The AI engine + guardrail dictionary** | The organizing brain + banned-vocabulary system | UPL-safe, source-linked processing IP | Other legal-tech (white-label / API) |
| **The extraction pipeline** | Doc → text → structured facts | A reusable document-intelligence service | Adjacent verticals, B2B licensees |
| **Aggregate corpus** | Many intakes over time | Benchmarks / trends (privacy-gated) | Firms, researchers — *with heavy caveats* |
| **Distribution** | Worker funnel + 91-firm CRM pipeline | The hardest thing to build | Powers every line below |

---

## Part 2 — Multiply money on the CORE (no new product)

The fastest revenue is on what you already sell.

1. **Value-metric pricing.** You already track **`crm_minutes_saved`** per firm. That is an ROI number sitting
   unused. Price against it: "you saved 40 hours last month" justifies a higher flat tier or a per-matter fee.
   Move from arbitrary tiers toward a value metric (per intake / per matter / per seat) that scales with usage.
2. **Land-and-expand.** Low entry (Practice), then grow seats + intake volume. Seats and volume are already
   the tier levers — lean into expansion revenue, which is cheaper than new logos.
3. **Priority / turnaround as a premium.** "Priority processing" already exists on Firm+. Sell faster
   turnaround, rush intake, or dedicated queue as an add-on — pure margin, no new build.
4. **Annual + multi-year + enterprise MSAs.** Annual prepay (Surge is annual) and multi-year enterprise
   contracts lock revenue and improve cash. Add an annual-prepay discount to the monthly tiers.
5. **Per-matter / overage pricing.** Intake caps (20/60/unlimited) already exist — charge a clean per-intake
   overage above the cap instead of only forcing a tier jump.

---

## Part 3 — New payers for the SAME assets

Same product, more wallets — none touch a recovery.

6. **Experts & service vendors (flat membership).** Court reporters, process servers, translators, e-discovery,
   vocational/economic experts pay a **flat listing/membership** to be in the marketplace. Flat membership >
   per-referral (anti-kickback). Fee is on *their* service, never the legal fee. (Phase 3, counsel-gated.)
7. **Other software (white-label / API).** License the organizing engine + extraction pipeline to
   practice-management tools and other platforms as a flat/usage SaaS fee. B2B2B, fully decoupled — often the
   highest-leverage line an engine like this has.
8. **Adjacent verticals, same model.** The identical subscription applied to **insurance / public adjusters**
   (Phase 5 validation), then other document-heavy plaintiff areas. New market, same clean mechanics.
9. **Worker-side premium (core stays free).** Optional, non-essential upgrades only: expedited processing,
   extra storage, professional export/formatting, e-sign/notary integration, a **portability fee** to push the
   record to additional firms. Never gate access to justice; never charge for legal help.
10. **Training & certification.** Sell courses or a "certified on one3seven" credential to firms/paralegals.
    Flat, content-based, high margin.

---

## Part 4 — New products on the SAME pipeline

11. **Litigation-ops module (Phase 2).** Deadline surfacing, packet ops, trial-notebook — a paid add-on on top
    of the base plan (~$249/mo target). Highest switching cost; deepens retention.
12. **Teleprompt (Phase 2).** The guided-call tool — a premium seat/usage add-on; answers the "personal touch"
    objection *and* is a new revenue line.
13. **Analytics / benchmarking (privacy-gated — caution).** Aggregate, de-identified insights ("intake volume
    trends," "typical timelines"). Real revenue for some SaaS, **but it collides with your worker-first
    "documents never sold" pledge** and the data is sensitive. Only with full de-identification, explicit
    consent, and privacy counsel — and weigh it against brand trust. Likely **not worth it**; listed for
    completeness.
14. **Integrations (paid connectors).** Clio and other integrations as paid features.

---

## Part 5 — Entity & structural leverage

15. **IP holdco.** Hold the engine/dictionary IP in a holding entity that **licenses** it to the operating co
    and to third-party licensees. Cleanly enables white-label/API revenue, protects the crown-jewel IP, and
    simplifies a future acquisition or spin-out.
16. **Isolate gated / regulated lines in their own entity.** If you ever pursue a **State-Bar-certified referral
    service** or **funding facilitation**, run it as a *separate, properly-licensed entity* so the core SaaS
    stays clean and un-conflicted. Never bolt a regulated line onto the software co.
17. **Adjacent ventures as separate cos.** Legal Fleet (Tad-operated depositions) and Journey School stay
    separate entities — cross-sell, but isolate their liability/regulatory profile from the SaaS.
18. **What entities *cannot* do:** create a subsidiary to take a % of winnings, per-case referral fees, or a
    litigation return. The prohibition follows the money, not the org chart.

---

## Part 6 — Under-monetized things you've ALREADY built

These exist in the code and aren't fully priced:

- **`crm_minutes_saved`** — a live ROI metric. Turn it into the pricing justification and into firm-facing "you
  saved X" reporting (a retention + upsell tool).
- **`document_facts` structured extraction** — a machine-readable data product that could power an API tier.
- **The guardrail / banned-vocabulary engine** — genuinely differentiated IP; the core of a white-label pitch
  ("UPL-safe AI processing, licensed").
- **The doc→text→facts pipeline** — a reusable document-intelligence service beyond employment.
- **Wage/damages + provenance engine** — a premium module already gated to `enterprise`; align the gate to the
  intended Firm+ tier (with counsel sign-off) so paying firms can actually buy it.
- **Portable Worker Record** — the seed of a worker-side and cross-firm revenue line (Phase 3).

---

## Part 7 — Bright lines (never, regardless of framing or entity)

- ❌ % of winnings / settlement / any success or "finder's" fee (non-lawyer fee-splitting, CA RPC 5.4).
- ❌ Per-case / per-lead / per-referral fee on legal matters (referral fee + §6155).
- ❌ Any fee contingent on a case outcome.
- ❌ Lending into cases / a return on litigation capital (referrer, never lender).
- ❌ Charging a worker for anything that gates access to justice.
- ❌ Selling identifiable worker data (violates the "never sold" pledge).

---

## Part 8 — Prioritized sequence (fastest clean dollars first)

1. **Now, no build:** value-metric pricing off `minutes_saved`; annual-prepay discount; priority-turnaround
   add-on; per-intake overage. Pure pricing moves on the existing product.
2. **Near:** fix the wage/damages tier gate (with counsel) so Firm+ can buy the premium module; firm-facing
   "time saved" reporting as an upsell.
3. **Mid:** white-label / API licensing (set up the IP holdco first); training/certification.
4. **Phase-gated:** Litigation-ops + Teleprompt add-ons (P2); expert/vendor flat-membership marketplace (P3);
   adjacent verticals (P5) — each behind its gate.
5. **Evaluate, don't rush:** analytics/benchmarking — only if privacy + brand survive it.

---

*Related: [billing-and-commissions.md](billing-and-commissions.md), [roadmap-phases.md](roadmap-phases.md),
[org-hiring-roadmap.md](org-hiring-roadmap.md).*
