# one3seven — Business & Website Scope

> Master reference snapshot. Last updated: 2026-06-25. Keep this current; it's the "if we lose everything, read this" document.

---

## 1. What it is
**one3seven** is an AI **employment-intake engine** for California plaintiff-employment matters. A worker uploads scattered records (pay stubs, HR emails, texts, write-ups); one3seven organizes them into a structured, **source-linked** intake packet — a clear timeline, categorized documents, surfaced dates — ready for an attorney to review.

**Iron rule:** it *organizes and reflects, never concludes.* No legal advice, no outcome predictions, no case-strength claims. Banned vocabulary is enforced in code (`src/services/bannedVocabulary.ts`): violation, owed/owes, entitled, liable/liability, strong/weak case, valid/invalid claim, "you have a case", guarantee, damages-as-label.

**Identity:** worker-first. Firms are phase-1 *distribution*, not the master of the product.

## 2. Entity & people
- **Entity:** One3Seven Ventures LLC (California, active — B20260291916). General area: Stockton/Tracy, CA. Legal contact: legal@one3seven.com.
- **Founder:** Victoria (vmramey@gmail.com), `is_founder`.
- **Sales rep:** Tad (tadmor86@gmail.com), `crm_role='rep'`.

## 3. Business model
- **Pricing:** Solo $199/mo · Practice $499/mo · Firm $899/mo. Practice+/Firm+ unlock the Section 8B wage-exposure calculator (CA only; records arithmetic, never conclusions).
- **Free 30-day pilot**, no credit card. Payments via **Stripe** (subscriptions; tier gated).
- **Rep commission:** 20% recurring monthly on every paying firm.
- **Launch bonus (first 3 paying firms):** $100 / $150 / $250 (=$500), + $250 sprint bonus if all 3 land in the sprint window. "Paying" = first Stripe invoice cleared. Pays within 1–2 business days of cleared invoice; 30-day clawback if the firm cancels.
- **Unit economics (per Practice firm, est.):** ~72% contribution margin after commission, Stripe fees, AI cost, and amortized infra. Fixed infra (~$50–100/mo) covered by firm #1. Modeled in CRM → **Company Economics** tab (founder + Tad only).

## 4. Distribution / sales
- **Channels, by leverage:** CELA (California Employment Lawyers Association) + warm referrals > email/LinkedIn > cold dialing (lowest yield).
- **Cold email:** free-pilot 3-touch sequence in CRM → Scripts. Personalize line 1, send from a person (not info@), separate sending domain for volume, CAN-SPAM (mailing address + opt-out).
- **Best opener:** the gift — "send me one messy intake, I'll return it organized in 24h, no commitment."
- **30 target firms** loaded in CRM with per-firm intel (`src/app/constants/crmFirmIntel.ts`).
- **Phase-1 gate:** 3 paying pilot firms. Bottleneck is execution, not engineering.

## 5. Website & routes (all off www.one3seven.com)
| Path | Surface | Access |
|---|---|---|
| `/` | Marketing home (worker landing) | Public |
| `/for-firms` | Firm pitch + pilot-request form | Public |
| `/terms`, `/privacy` | Legal | Public |
| `/demo` | Firm demo | Public |
| `/worker-demo` | Worker demo | Public |
| `/fire-demo` | Fire-displaced worker demo (counsel-gated "Readiness" wording) | Public |
| `/hq` (or `/one3sevenhq`) | Founder + rep CRM | Founder/reps |
| `/company-demo` | Rep demo coach (Coach/Present) | Founder/reps |
| `/company-demo/debrief` | Post-demo debrief form | Founder/reps |
| `?fc=CODE` | Firm-directed worker intake (prefills firm code) | Public |
| `?billing=...` | Stripe return handler | — |

Routing is in `src/main.tsx` (pathname checks) + an in-app state-machine router in `src/app/App.tsx` (`currentScreen`). Founder Links directory: CRM → **Links** tab.

## 6. Product surfaces
- **Worker (light brand):** guided intake, story intake, employment-matter details, category questionnaire, upload, processing, personal timeline/dashboard, intake summary, file preview, settings, worker PDF. Worker controls if/when/with whom to share.
- **Firm/attorney (light brand work surface):** law-firm dashboard (intake queue, readiness states, search/filters), deep per-intake review workspace (`IntakeReviewScreen`), firm-directed intake, firm settings. **Firm PDF packet** (prestige pdf-lib renderer): review snapshot, 2B extracted-from-documents, chronology, priority questions, supporting records, **8B wage-exposure estimate**, **clickable source-linked citations** (jump to embedded source page). RLS-enforced firm isolation (independently verified).
- **Internal CRM (`/hq`, founder/reps):** Dashboard, Pipeline, Firms (All/Mine/To-contact + one-tap "Emailed"), Activity, Metrics (time-saved + credit-by-rep), Revenue (founder), Earnings (rep bonus tracker + calculator), Company Economics (founder+Tad), Team chat, Notes, Scripts, Training, Ask one3seven AI, Checklist (founder), Audit (founder), Links (founder), Add/Log.
- **Demos (light brand — mirror the real product):** /demo, /worker-demo, /fire-demo.
- **Marketing & For-Firms (dark "persuasion" brand).**

## 7. Design system (see memory: project_design_system_dark)
Persuasion surfaces = **dark ink #14112E** + Fraunces serif + violet #5B21B6, restraint over gradients. Work/product surfaces = **light**, same type system. Demos follow the product (light). PDF packet is brand-locked/presentation-only.

## 8. Tech stack & infra
- React + TypeScript + Vite + Tailwind. Animation: motion. PDFs: pdf-lib. Icons: lucide-react.
- **Supabase** (Postgres, RLS, Storage, Deno edge functions). Project ref `ebgkomrujmrkpetcdbgp`.
- **Anthropic** API (server-side only) — model `claude-sonnet-4-6`, prompt caching on. Key is `ANTHROPIC_API_KEY` in edge env, NEVER `VITE_`.
- **Vercel** hosting (deploys on push to `main`). Repo: github.com/vmramey-gif/one3seven.
- Frontend env: only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. Stripe price IDs via `VITE_STRIPE_PRICE_*`.
- 42 test files (~247 tests) — keep green before deploy.

## 9. Data model & backend
- **Tables:** contact_messages, crm_activity, crm_firms, crm_invites, crm_messages, crm_notes, demo_debriefs, demo_nda_log, intake_summaries, notifications, pilot_interest, timeline_events, web_events, file_text_extractions, intake_routes, firm/worker profiles, subscriptions. All RLS-enabled.
- **Edge functions:** chat-assistant, create-checkout-session, create-portal-session, extract-document-facts, get-intake-intelligence, stripe-webhook. (extract-document-facts uses retry/backoff; AI is an enrichment layer — outages degrade gracefully, worker flow never hard-blocks.)
- **Migrations:** in `supabase/migrations/` (operator-applied via Supabase SQL editor / CLI). Latest: crm_attribution, contact_messages, web_events, demo_debriefs.

## 10. Security posture
RLS on every table; no anonymous read access (only insert-only on pilot_interest + web_events + contact_messages). Service-role key server-side only, never in client; no secrets committed. Stripe webhook signature-verified; checkout authorizes firm ownership + validates price IDs. **Known item to harden:** `extract-document-facts` uses service-role without an explicit caller-ownership check (potential IDOR). Human layer (founder account + 2FA) is the real attack surface. No SOC2/HIPAA — do not claim certifications not held.

## 11. Analytics
First-party, cookieless, DNT-respecting (`src/lib/analytics.ts` → `web_events`). Tracks pageview, nav_for_firms, pilot_view/submit/success, contact_submit. Founder-only read. No third-party ad trackers. SEO: meta/OG tags, robots.txt, sitemap.xml.

## 12. Contact channels
- **info@one3seven.com** — general (marketing footer, landing, firm settings, in-app contact form). Confirmed receiving.
- **legal@one3seven.com** — legal/privacy/deletion.
- **Pilot-request form** on /for-firms → `pilot_interest` table. In-app contact form → `contact_messages`.

## 13. Roadmap
- **Phase 1 (now):** organized intake → land 3 pilot firms.
- **Phase 2:** expert match (uses sourced intake data).
- **Phase 3:** financial layer — case-stage data as underwriting signal (citations are the data-integrity foundation).

## 14. Operator runbook
- **Deploy frontend:** push to `main` → Vercel auto-deploys (~1–2 min).
- **Deploy an edge function:** `npx supabase functions deploy <name> --project-ref ebgkomrujmrkpetcdbgp` (stored token). Required after editing chat-assistant, extract-document-facts, etc.
- **Apply a migration:** run the SQL file in Supabase SQL editor (or CLI). The agent cannot apply migrations or deploy functions — the founder does.
- **Domains:** add variant domains in Vercel → "Redirect to one3seven.com" (308). `onethreeseven.com` is the top mistype to grab.

## 15. Open threads / known gaps
- `/fire-demo` "Readiness/exposure" wording is demo-only **pending counsel UPL sign-off** — do not ship to production worker/firm screens.
- Harden `extract-document-facts` authorization (IDOR).
- 60-second product video (script direction ready; needs recording).
- Counsel review of Terms/Privacy + E&O insurance.
- Source-linked citations Phase 2 (extend to all extracted facts; needs extraction backend change).
- Re-extraction backfill for files that fail during an AI outage.
- Get a real mailing address (PO box) before bulk cold email (CAN-SPAM).

---
*Memory index lives in `~/.claude/.../memory/MEMORY.md`. This file is the human-readable mirror.*
