# one3seven — Full Scope & Knowledge Audit
*Snapshot for context transfer. Current as of this session (mid-2026).*

## 1. What it is (one line)
one3seven is a California plaintiff-employment intake platform: a worker uploads scattered employment records → AI organizes them into a **source-linked timeline / intake packet** for an attorney to review. The governing principle, stated everywhere: **"Organizes and reflects — never concludes."** It does not give legal advice, predictions, scores, or conclusions. Attorneys evaluate everything.

## 2. Identity & vision
- **Worker-first**, not firm-intake software. The worker is the primary user; firms are **Phase 1 distribution only**. (Core rule: read before every build decision.)
- Marketing reframe ("Velocity Pivot"): sell **speed-to-decision** and **no-limbo for both sides**, not "organization." Firm pitch = "reserve your seat in the network" (worker chooses firms), NOT white-label.
- Origin story (founder): *"You should only have to tell your story once."*

## 3. Team
- **Victoria Ramey** — founder (vmramey@gmail.com; victoria@one3seven.com).
- **Tadmor "Tad" Russell** — **co-founder** (not just sales), drives sales (tadmor86@gmail.com). Has a phone, no Calendly.
- ⚠️ **Founder agreement + IP assignment with Tad is NOT done** — flagged as the #1 non-code startup risk; needs a real attorney.

## 4. How the product works (worker flow)
1. Worker signs in, optionally enters a **firm code** to route their intake to a specific firm.
2. Guided intake: worker tells their story + uploads documents (recall aids anchor on **events, sequence, people, documents — never emotional/physiological state**).
3. AI organizes into: a **document-linked chronology**, **records-based arithmetic** (e.g. hours from timecards), matter tags, and surfaced clarifications.
4. Firm gets a **review-ready, source-linked packet** in their dashboard; every fact links back to the worker's words or a source PDF page.

## 5. Tech stack
- **Frontend:** React + TypeScript + Vite; Tailwind; MUI; motion/react; PWA. Deployed on **Vercel** (auto-deploys from `main`). Route detection in `main.tsx` (`/demo`, `/for-firms`, `/hq`, `/tx-demo`, `/fire-demo`, `/worker-demo`).
- **Backend:** **Supabase** (Postgres + RLS + Realtime + Edge Functions). Project ref `ebgkomrujmrkpetcdbgp`.
- **AI:** Anthropic **Claude** (`claude-sonnet-4-6` for the sales assistant; extraction functions). "Built on / Powered by Claude" is OK in copy; NO partner/certified/endorsed/logo claims.
- **PDF:** pdf-lib prestige renderer (firm + worker packets), with clickable **source-linked citations** (provenance slices).
- **Edge functions:** chat-assistant, create-checkout-session, create-portal-session, extract-document-facts, get-intake-intelligence, stripe-webhook, **notify-pilot-lead** (new).
- Deploy edge fns: `npx supabase functions deploy <name> --project-ref ebgkomrujmrkpetcdbgp`. DB changes: operator runs SQL/migrations in the Supabase SQL editor (agent does not write prod).

## 6. Business model & pricing
- **Free 7-day pilot**, no credit card. Paired with an instant sample packet (`/demo`) so firms see output immediately; "decide within the week."
- **Subscription tiers:** Solo **$199/mo** · Practice **$499/mo** · Firm **$899/mo** (+ enterprise). Internal plan id `beta_pilot` / status `trialing` for pilots.
- **Sales comp:** 20% MRR residual to reps; commission starts only on **pilot → paid** conversion; escalating one-time bonus for the first 3 firms that convert; 30-day clawback.
- No fee-splitting on case outcomes (CA Rule 5.04 / Opinion 706). Flat-fee only for firm-tool model (esp. Texas).

## 7. Key surfaces / routes
- `/` — worker marketing homepage (founder-origin banner, "See a sample intake packet" CTA).
- `/for-firms` — firm marketing + **Start free pilot** form.
- `/demo` — sample intake packet ("Marcus Rivera" sample) shown to firms.
- `/hq` — **Founder CRM** (internal sales tooling; founder/rep gated).
- `/tx-demo` — Texas criminal/DWI demo (Harris County).
- `/fire-demo`, `/worker-demo` — demo variants.
- `/company-demo` + `/company-demo/debrief` — internal demo coach.

## 8. Guardrails & compliance (HARD RULES — never violate)
- **Organizes and reflects, never concludes.** No "you have a case," no valuations, no outcome estimates, no attorney recommendations, no case scoring, no drafting, no chatbot.
- **Not a law firm / not a lawyer referral service.** Attorneys independently evaluate all info.
- **Provenance named by SOURCE, not worth** (Source-linked / Document on file / Worker-stated — never "unverified").
- **PI/exposure language is worker-surface-only** — never seeds firm-side PI review/scoring/medical categories unless a PI workflow is intentionally built.
- **Readiness band + firm exposure surfacing are demo-only** — do NOT ship to production worker/firm screens without counsel sign-off (UPL line).
- **Voice = TTS of fixed vetted scripts only**, never a live conversational agent.
- **No overclaiming** in marketing: only defensible metrics. Removed false "15 minutes," "6 schemas," "100% traceable." Kept: "0 legal conclusions · 100% source docs preserved · 1 link · Minutes."
- **Anthropic:** "Built on/Powered by Claude" + CA-statewide adoption line OK; no partner/endorsed/logo lockup. "Only Organizes and Reflects, Never Concludes" is ours.
- **Texas:** firm-tool + flat-fee only; no case %, no solicitation (barratry §38.12).
- **Security:** each firm sees only its own intakes (row-level policies, independently verified). Uploaded docs organize the intake; not used to train models.

## 9. Sales apparatus (the /hq CRM)
- **Pipeline** of firms (`crm_firms`): stages target → contacted → convo → demo_booked → demo_done → pilot → paid → no → nurture. Priority flags A/B/C. **Tiers 1–4** set call order + which pitch (Tier 1 tech-native "call first" … Tier 4 traditional "call last").
- **~350 CELA firms** imported + tiered (Tier1:10, Tier2:84, Tier3:217, Tier4:39).
- Rep tooling: tier-aware **Call Brief** (4 verbatim angles + objection prep), one-tap **claim** (Open pool vs "Yours"), fast-log outcomes, priority/tier dropdowns. Rep scoping: reps see only their own stats/activity; team-wide views are founder-only. Tad labeled "Co-Founder."
- **Team chat + private DM inbox + shared notes**, all realtime, with unread indicators + Live/Polling pill. (Now with emoji + inline-GIF support — pending deploy.)
- **Ask one3seven AI** (internal sales assistant, CRM-only) — knows CA employment rules, CA+Anthropic credibility, Eve/Clio suits, competitor lanes, specialties, 7-day pilot.

## 10. Competitive & regulatory landscape (talking points)
- **Competitors:** Eve (Butler Labs) — sued for patent infringement by AI.Law; Clio acquired vLex/Fastcase ($1B) + Alexi antitrust countersuit. Positioning: most legal AI **drafts/scores/recommends** (invites hallucinated citations, blurred responsibility); one3seven is intentionally narrower — **it organizes the record**. No-disparage rule.
- **Regulatory tailwind (CA):** regulators describe OUR pattern (burden on attorney) as compliant; **AB 316** (no "AI acted autonomously" defense) → visible/auditable traceability is the priority build; SB 574 tailwind; CA State Bar Opinions 705/706; CA–Anthropic statewide partnership = sales credibility. Texas: TRAIGA 2.0, TDPSA.
- **Why attorneys love/hate legal AI:** love speed/leverage; hate hallucination, UPL exposure, black-box summaries. one3seven answers the "hate" with auditability + never-concludes.

## 11. Current state — what's LIVE (prod)
- Worker intake + firm dashboard + source-linked packets.
- `/for-firms` pilot form → `pilot_interest` table → **auto-creates a priority-A CRM card** (DB trigger, tested this session).
- **31–32 confirmed firm emails** loaded into the CRM (all Priority A/B + Tier 1 core + Tier 2 core).
- Firm-facing sites verified rendering clean (homepage, /for-firms, /demo — zero console errors).
- CRM: realtime chat/DM/notes, claim flow, tier briefs, Ask AI.

## 12. Recent work (this session)
- Found + loaded confirmed emails for ~32 high-value firms (A/B + Tier 1 + Tier 2 core).
- Built + tested the pilot-interest → CRM auto-card trigger.
- Fixed CRM firm-name truncation (full names show) — *pending frontend deploy*.
- Added emoji + inline-GIF support to CRM chat/DM/notes — *pending frontend deploy*.
- Wrote `notify-pilot-lead` edge function (emails **victoria@one3seven.com** on each pilot request via Resend) — *code written; needs Resend setup + deploy*.

## 13. Open items / roadmap
- **Deploy:** frontend redeploy (full names + emoji/GIF); `chat-assistant` redeploy (updated prompt); `notify-pilot-lead` (Resend key + webhook).
- **Emails:** ~48 remaining Tier 2 long-tail firms; inferred addresses to review; original-30 firms.
- **Build:** searchable Giphy picker (needs free API key); deal-brief two-tier layout; Phase 2 source-linked citations (Section 2B provenance extraction); trial-expiry automation (`trial_ends_at`).
- **Non-code (highest priority):** founder agreement + IP assignment with Tad.
- **Admin:** fill Tad's phone number in caller brief.

## 14. Sales targets in motion
- Warm leads: **Gosch Law Firm** (Hearne TX) — firm-tool + flat-fee wedge (criminal/DWI/family).
- Priority A firms: Ricca, Jean Hopkins Power, Zadourian, Lawrance Bohm, Kelsey Ciarimboli.
- Founder-led sales stage; Tad drives outreach.
</content>
