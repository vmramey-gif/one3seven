# RESERVED — Neutral Firm Directory + Worker-Directed Send

> **STATUS: IN RESERVE. DO NOT BUILD OR SHIP YET.**
> This is the "worker chooses from a pool of firms" moat, engineered to sit as close to legal as possible
> without State Bar certification. It is **gated behind two conditions** and the existing flag
> `PARTICIPATING_NETWORK_LIVE = false` (in `src/app/constants/flags.ts`). Activate only after both:
> 1. **The firm-code / firm-link model is live and earning** (firms bring their own clients, pay for the software).
> 2. **Counsel has signed off** on this exact structure (and/or the certification path is decided).
> Until then: not built, not pitched as live, not framed as "leads" or "a pool of attorneys you pay to join."

*Last updated 2026-07-18. See [[project_velocity_pivot]], `docs/roadmap-phases.md` (cert-gated parallel track),
and the §6155 analysis in `docs/monetization-map.md`.*

---

## The concept (what it becomes, later)
Layered **on top of** the firm-code model: a **neutral directory** of firms on the platform that a **worker**
independently browses and sends **their own organized record** to — choosing based on firm-provided, factual
bios. Same worker-choice experience the team keeps asking for; structured to be a *neutral platform + worker
action*, not a lawyer referral service.

## Why the naive version is illegal (the 3 levers)
A California lawyer referral service (§6155) is, in plain terms: **(1) we match/route clients to attorneys,
(2) attorneys pay for that access, (3) we curate which attorneys the client sees.** LegalMatch was found to be
an unregistered LRS on exactly these — and "the client chooses" did **not** save it.

## Build to these six constraints (flip every lever)
1. **The worker is the only actor.** Worker owns the record, searches, chooses, and hits send. We never match
   or route. Everything framed as worker empowerment, never lead delivery.
2. **The fee is for software, not for clients.** Firms pay a flat subscription for the organizing tool +
   profile + inbox — the same whether they receive 0 or 50 workers. Never per-lead, never per-worker, never
   contingent on receiving anyone.
3. **No pay-to-be-seen.** No firm can pay to rank higher or appear more. Visibility is neutral. (Pay-for-
   placement = pay-for-referral.)
4. **Bios are firm-provided and factual; we never editorialize or rank.** Firms write their own truthful
   highlights (subject to attorney-advertising rules — no guarantees, no false claims). We display neutrally
   and let the worker filter by *their own* criteria (location, practice area). We never write "why choose
   them" or rank firms — that's steering (referral-service-like + UPL risk).
5. **Explicit worker consent at every send.** Nothing auto-routes; the worker chooses and confirms each firm.
6. **Loud disclaimers.** "We are not a lawyer referral service. We do not recommend, endorse, or vouch for any
   attorney. Firm profiles are attorney-provided advertising."

## Honest caveat (do not forget)
Even built to all six, this lives in **LegalMatch's shadow**: attorneys still pay *and* the platform still
connects them to clients, so a regulator *could* still argue LRS. The six constraints **reduce** risk and give
counsel the best structure to defend it — they do **not** zero it. **The only zero-risk paid-pool version is
State Bar LRS certification.** Treat it as a gradient, not a switch.

## Sequence
1. **Now:** firm-code / firm-link model only. Firms bring their own clients; pay for the software. Zero
   referral risk. Earn revenue, prove value, accumulate switching costs.
2. **When gates open (both conditions above met):** build this neutral directory as an **incremental** layer —
   the worker already owns and can send their record; this adds neutral discovery + firm profiles. Flip
   `PARTICIPATING_NETWORK_LIVE` only after counsel signs off.
3. **Parallel track:** pursue **State Bar LRS certification** — the only path to the *full* pool moat where
   firms pay for placement. It's a whole project, run alongside, not a feature flip.

## The one question for counsel
> "If we build a firm directory with these six constraints — worker-initiated, flat software fee, neutral
> non-curated visibility, firm-provided factual bios, explicit consent, clear disclaimers — are we outside
> §6155, and what would you change? And separately: what would State Bar LRS certification require?"

Get the answer **in writing** before any of this ships or any firm is told it can "join the pool."
