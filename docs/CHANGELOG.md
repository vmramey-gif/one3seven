# one3seven — Changelog

Append each work session to the **top**. Date it, group changes by product area, and note anything
that shipped to production vs. is pending. This doubles as the traction record for investors/advisors
and the handoff record for Tad / future hires. ~30 seconds per session.

Legend: ✅ shipped to prod · ⏳ built, pending deploy/config · ⚠️ risk / known gap

---

## 2026-07-06 — Firm-first relaunch, CRM v2, pricing, access gate

### 🏠 Homepage & marketing
- ✅ **Firm-first homepage** — `/` now leads with a firm-geared hero ("Open the file. Decide in minutes."), free-pilot CTA, and a "For workers" nav pill. Firm-code intake links (`?fc=`) and returning logged-in users still route to the worker app; worker home available at `/workers`.
- ✅ **Founder origin story** relocated from `/` to the worker home page (`AuthWelcomeScreen`).
- ✅ **Worker home page** restyled to the dark brand theme (matches homepage).
- ✅ **Logo → home** CTA on homepage + worker home.
- ✅ **EN/ES language toggle** (`src/i18n/`) — persistent (localStorage), translates the homepage hero + nav and the worker home. LEGAL-REVIEW flag: bilingual review recommended on disclaimer strings before real reliance.

### 📄 Sample packet (`/demo` → `IntakeReviewScreen`, production firm-review screen)
- ✅ **Timeline rail** connecting chronology events (reads as a sequence, not a list).
- ✅ **Unified section eyebrow labels** across the packet.
- ✅ **Provenance credibility dots** — Record-grounded (green) vs Worker-reported (amber).
- ✅ **Processing Summary stat tiles** — Documents / Timeline events / Clarifications render as bold numbers on open.
- ✅ **Section spacing rhythm** (`gap-5` → `gap-6`).
- ✅ **Pricing fixed** in the closing CTA (Solo $149 → Practice $249).

### 🗂️ CRM (`/hq`) — v2 redesign
- ✅ **Dense CDK-style firm table** — responsive, no horizontal scroll; columns reveal by breakpoint (Firm/Stage/Actions on mobile → +Tier/Next → +Attorney/Owner).
- ✅ **Filter bar** — contacted/not-contacted, tier, priority, stage, timing (due today / going cold / recently worked), email, + search + clear.
- ✅ **Compose-then-submit log modal** — centered; multi-select outcome chips (Called, No answer, Left voicemail, Spoke with them, Gatekeeper, Not interested, Callback scheduled, Demo booked, Pilot started, Do not contact, Victoria to email f/u) + free-text notes + follow-up date; smart stage advance on submit. Replaced the old single-outcome fast-log (also fixed a NaN bug).
- ✅ **Founder rep scoreboard** — per-rep calls/emails today, demos/week, pilots, last-active.
- ✅ **Row dispositions** (⋯ menu) — Do not contact (→ `no`) and Not interested (→ `nurture` + auto-requeue in 3 months).
- ✅ **Emails shown on firm cards**; **full firm names** (no truncation); **emoji + inline-GIF** in team chat / DM / notes.
- ✅ **Intentional claim** (removed auto-claim on log) + **founder assign-rep** dropdown.
- ✅ **Inbound pilot section** (priority-A cards) + **Victoria email follow-up queue** (needs_founder_email flag).

### 💰 Pricing
- ✅ **New tiers everywhere:** Practice $249 / Firm $549 / Surge $1,490 (annual only); Solo dropped. Volume-gated, core packet identical on all tiers. See [[project_pricing]] / `docs/insurance-vertical-validation.md` sibling notes.
- ✅ **Commission calc** (20% residual): Practice $49.80 · Firm $109.80 · Surge $298. Applied in crmAnalytics, crmTraining, billingService, crmReference, FounderCRMScreen, and the Ask-AI prompt.
- ⏳ **Stripe products** for $249/$549/$1,490 still need creating before real billing (not needed in pilot mode).

### 🔒 Access & lead pipeline
- ✅ **Signup hold-gate** — new worker/firm accounts hit a "pending 1–2 business days" screen instead of the product; the signup is still captured as a lead. Founders/reps bypass. Approve via `update public.profiles set approved = true where email = '…'`.
- ✅ **Pilot form → auto priority-A CRM card** (DB trigger `pilot_interest_to_crm`).
- ✅ **Email alert to victoria@one3seven.com** on every pilot signup (Resend + Supabase webhook + `notify-pilot-lead` edge function).
- ✅ **Phone field** added to the pilot form (flows to CRM card + alert email).
- ✅ **32 confirmed firm emails** loaded into `crm_firms` (Priority A/B + Tier 1 core + Tier 2 core).
- ✅ **Site analytics fixed** — `web_events` inserts were silently failing (missing grant); now tracking visits. Founder "Growth" tab reads it.

### 📓 Sales enablement (docs / memory)
- ✅ **Marcus Rivera demo story** written up for Tad (the sample-intake persona).
- ✅ **Insurance-vertical validation playbook** (`docs/insurance-vertical-validation.md`) — public-adjuster buyer, 11 discovery questions, positioning, disclaimer. VALIDATION-ONLY until 3 paying CA firms.
- ✅ Caller brief · call-to-pilot playbook · full product audit · pilot-lead-notification setup.

### ⚠️ Known gaps / risks (as of this session)
- **Worker intake flow — not design-passed.** Deferred on purpose (can't screenshot-verify: animated + auth-gated), BUT it's a **pre-Aug-3 risk**, not a someday-item: a confused/dated screen during a live pilot is a first-impression hit on the exact worker whose experience decides firm renewal. **Action: walk the full flow as a fake worker before Aug 3** and fix the obvious stuff by eye.
- **Founder / IP agreement with Tad** — still unpapered. #1 non-code company risk. See [[project_founder_agreement]].
- **Resend sending domain** — currently sends pilot alerts from the test sender `onboarding@resend.dev` (only delivers to the account owner). Verify `one3seven.com` in Resend to send from `alerts@one3seven.com` to any recipient.
- **Rotate exposed keys** — the Resend API key and Supabase service_role key appeared on-screen during setup; rotate when convenient.
- **~48 Tier-2 long-tail firm emails** still to research.
</content>
