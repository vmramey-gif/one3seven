# one3seven Attorney Pool — Compliance Blueprint

**Status:** Draft for counsel review. Not legal advice. Every element below must be
confirmed in writing by a California legal-ethics attorney before any firm or worker
touches a live pool. Author: internal (product). Last updated: 2026-07-25.

> **The pool in one sentence.** A neutral, named directory of California employment
> firms — each firm owns and is liable for its own listing and pays a flat advertising
> fee decoupled from outcomes — that the worker browses, filters by their own criteria,
> and initiates contact with (one firm or several). one3seven never ranks firms, never
> matches, never evaluates the worker's case to steer, keeps each firm walled off from
> the others, and never touches the money.

---

## 1. What we are — and what we are deliberately not

| We ARE | We are NOT |
|---|---|
| **Joint advertising** under Bus. & Prof. Code **§6155(g)** — named firms the consumer may select and contact | A **lawyer referral service** (§6155(a)) — no State Bar certification, because we never refer |
| A **directory / marketplace** the worker navigates | A **lead generator** selling client contacts to firms |
| A **software tool + advertising platform** | A **matching service** (the *Jackson* line) |

The whole model lives or dies on one distinction the California courts drew in
**_Jackson v. LegalMatch_ (2019) 42 Cal.App.5th 460: *matching* a client to a lawyer is a
"referral."*** Function beats form — a disclaimer does not save a platform whose
*function* is matching. Therefore the load-bearing rule is absolute:

> **one3seven never matches. The worker selects. Always.**

---

## 2. The four bright lines (never cross)

1. **Never route to an unnamed firm.** Every firm on the roster is named; the worker
   picks by name and initiates contact. Referring a consumer to an attorney *not
   identified in the advertising* is the statutory definition of certifiable referral
   activity (§6155(g)(2)).
2. **Never rank, match, score, or recommend firms.** No algorithm, no "best fit," no
   "recommended for you," no sort-by-predicted-success. Presentation is neutral
   (alphabetical, worker-set filters, or worker-controlled order only).
3. **Never use the Claim Lens (or any case analysis) to steer firm selection.** Rule 7.2
   cmt.: a platform must not create the impression it "has analyzed a person's legal
   problems when determining which lawyer should receive the referral." The engine and
   the directory are architecturally separate. (See §6, the firewall.)
4. **Never take a cut of outcomes, and never touch the money.** Flat fee only (Rule 5.4 /
   1-320 fee-splitting). Settlement funds flow through the attorney's trust account
   (Rule 1.15) — never through one3seven (see §9).

---

## 3. The compliant architecture (component by component)

### 3.1 Named directory
Each firm appears as a named listing: firm name, responsible California-licensed
attorney, physical office address, practice focus, languages, locations served, and the
firm's own description. No one3seven-authored claims about any firm.

### 3.2 Worker-initiated selection — single or multiple
The worker browses and **chooses** which firm(s) to send their organized record to. They
may pick **one or several** — deliberately, firm by firm. Multi-select is encouraged: it
proves the worker is *shopping*, not being matched, and it is the opposite of the
"exclusive leads" model regulators punish.

- **No one3seven auto-blast.** There is no "send to all firms" button that one3seven
  fans out — that would be one3seven *distributing* the record, which reads as lead
  distribution. The worker selects specific named firms.

### 3.3 Neutral presentation
Default order is neutral (alphabetical or worker-randomized). Filters are **facets the
worker controls** (county, practice area, language) — like any directory. one3seven never
sorts by predicted merit, responsiveness-score, or "fit."

### 3.4 Joint-advertising agreement (per firm)
Every participating firm signs an agreement that (§6155(g)):
- **names** the firm as one the consumer may select and initiate contact with, and
- has the firm **expressly take liability for the content of its own listing.**

The firm supplies and owns its listing copy and its SB 37 disclosures.

### 3.5 Flat, decoupled fee
Firms pay a **flat** periodic advertising fee for the listing/presence. **Not** per
worker, per contact, per signed matter, or % of recovery. Combined cost to the worker
stays **$0** (§6155(a)(2) — combined charges may not exceed what the client would
normally pay). See `roster-not-leads` doctrine.

### 3.6 Firm isolation (Rule 1.6 — mandatory)
When a worker shares with multiple firms, **Firm A must never see that Firm B also
received it.** Each firm sees only "this worker shared with us." Enforced at the data
layer (RLS). This is a confidentiality obligation, not a nicety.

### 3.7 SB 37 disclosures on every listing
Because a firm listing functions as attorney advertising, each card must carry:
- the **name** of at least one responsible California-licensed attorney,
- a **physical office address** (city/county; no P.O. box / virtual-only),
- **no** guarantees, outcome predictions, or "fast cash" language; disclosed
  dramatizations; no impersonation.

SB 37 (eff. 2026-01-01) puts **strict liability on the attorney** for non-compliant
third-party ads — so compliant-by-construction cards are a **selling point** to firms,
not just a burden.

### 3.8 The Claim Lens firewall
The Claim Lens (and any case analysis) **never** feeds firm selection, ordering, or
eligibility. It is a tool the *worker* uses on their *own* record and the *attorney* uses
after the worker chooses them. It must be impossible for the engine's output to change
which firms the worker sees or how they are ranked.

### 3.9 Panel breadth
Do not market "network" language until there is genuine breadth (aggregator guidance
points to panels of ~20+ attorneys to avoid looking like funneling to a single firm).
With a handful of pilot firms, one3seven is "a tool several firms use," not a network.

---

## 4. Adversarial test — how each landmine is defused

| Landmine | Authority | How the design survives it |
|---|---|---|
| "Matching = referral" | *Jackson v. LegalMatch* | Zero matching. Worker selects named firms; one3seven does no matching, ranking, or steering. |
| Operating an uncertified referral service | §6155(a) | We are joint advertising (§6155(g)): named firms, worker-initiated, firms liable for content. |
| Fee-splitting with a non-lawyer | Rule 5.4 / 1-320 | Flat advertising fee, decoupled from outcomes. No % of recovery, no per-matter bounty. |
| Paying for a "recommendation" | Rule 7.2(b) | We recommend nothing. Flat ad fee for a listing the worker navigates. |
| "Analyzed the case to route" | Rule 7.2 cmt. | Claim Lens firewalled from firm selection (§3.8). |
| Strict-liability non-compliant ads | SB 37 | Required disclosures on every card; firm owns and is liable for its listing (§3.4, §3.7). |
| Confidentiality / privilege leak | Rule 1.6, Formal Op. 2010-179 | Firm isolation via RLS (§3.6); worker owns and controls all sharing. |
| Runner/capper, solicitation | §6152, Rule 7.3 | No solicitation; workers arrive inbound and self-select. No real-time steering. |
| Handling client funds | Rule 1.15, money-transmission law | Money never touches one3seven (§9). |

---

## 5. The worker flow (UX that keeps it compliant)

1. Worker builds their own organized, source-linked record (the core product).
2. Worker opens the directory of **named** firms; browses, filters by their own criteria.
3. Worker **selects** one or more firms — deliberately, by name.
4. Worker **sends** their record to the firm(s) they chose. one3seven transmits; it does
   not choose, rank, or add firms.
5. Each firm receives only its own copy; firms are walled off from each other.
6. The worker owns the record throughout and can revoke access at any time.

**What the UI must never show the worker:** "recommended firms," "best match for your
case," "top-rated," "firms most likely to take your case," or any ordering derived from
their case facts.

## 6. Firm onboarding (what a firm agrees to)

- Signs the **joint-advertising agreement** (names itself; takes content liability).
- Supplies **SB 37 disclosures** (responsible attorney + physical address) and its own
  listing copy (no guarantees/predictions).
- Pays the **flat** advertising fee (decoupled from any worker/matter/outcome).
- Acknowledges it receives only records **workers chose to send it**, and that it
  independently evaluates every matter (no one3seven conclusions).

## 7. Feature-creep watchlist (the tripwires that flip us into a referral service)

Any of these, if shipped, likely converts one3seven from directory → referral service and
triggers §6155 certification + strict liability. **Do not build without counsel:**

- "Recommended / best-match / top firms for you"
- Sorting firms by predicted success, responsiveness, or case fit
- Using Claim Lens output to filter or order firms
- Auto-sending a worker's record to firms one3seven selects
- Exclusive-lead arrangements or per-matter/per-signed-case pricing
- Any fee that scales with volume of workers delivered

## 8. The money boundary (settlement / payment)

The worker's journey can run all the way to *understanding they got paid* — but the
**dollars never flow through one3seven.** Settlement funds are the attorney's trust-account
duty (Rule 1.15); moving money (even free) triggers money-transmission licensing. one3seven
**mirrors** the settlement (the worker's copy of the settlement agreement + disbursement
statement, plain-language orientation, tax docs, "attorney sent your statement on X"
receipts) and **never becomes the channel** for the funds.

## 9. Counsel sign-off checklist (before any live pool)

- [ ] Confirm the joint-advertising structure (§6155(g)) fits this exact UX, in writing.
- [ ] Approve the joint-advertising agreement template (naming + content liability).
- [ ] Confirm the flat fee + $0-to-worker satisfies §6155(a)(2) and Rule 5.4.
- [ ] Approve SB 37 disclosure requirements on listing cards.
- [ ] Confirm firm-isolation (Rule 1.6) design is adequate.
- [ ] Confirm the Claim Lens firewall is sufficient to avoid "analyzed the case to route."
- [ ] Confirm no "network"/panel representations until breadth exists.
- [ ] Confirm the money boundary (no funds through the platform).

## 10. Sequencing

The pool is **Phase 3+**, gated behind: (a) the founder/IP paperwork, (b) three paying
firms, and (c) counsel sign-off on this blueprint. Nothing about the pool ships to a real
worker or firm before all three clear. Until then, the directory can be designed and
prototyped, but not operated live.

---

*Cross-references: `roster-not-leads`, `vendor-data-duties`, `case-journey-platform`,
`ca-ai-legal-landscape`, `monetization-doctrine`, `velocity-pivot` (internal memory).*
