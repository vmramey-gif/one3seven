# Integration & Sync Landscape — "No More Extra Dashboards"

**Status: research only (2026-08-05).** Company is in feature freeze finishing the cleanup pass. Nothing here gets built until the founder green-lights it. This maps *where* one3seven could sync so firms and workers don't need another standalone dashboard.

## Constraints every integration must pass (locked doctrine)

1. **Distribution filter:** "Does the worker choose us, or are we a step inside someone else's funnel?" Clio-Grow-style *firm-side sync* = YES. Becoming invisible middleware inside a lead-gen funnel = NO.
2. **Worker owns the record.** Any sync sends a *copy*; the worker's own copy and export always stay intact.
3. **No outcome/merit data leaves the platform.** Synced payloads are organized records only — never Coverage Rate, readiness bands, scores, or anything a regulator could read as case evaluation (§6155 / UPL).
4. Ranking keys: **(a)** how many "extra dashboard" complaints it kills · **(b)** build effort given API maturity · **(c)** doctrine risk (none / low / counsel-gated) · **(d)** phase (pilot-now / after-3-firms / later).

---

## 1. Firm practice-management platforms

| Platform | API / marketplace reality (2026) | Intake & doc ingestion | Partner cost / gating | CA plaintiff-employment fit | (a) | (b) | (c) | (d) |
|---|---|---|---|---|---|---|---|---|
| **Clio (Manage + Grow)** | Two dev tracks: Clio Manage API + new **Clio Platform** (Grow apps built here). Free dev account; ~250-app directory. Legacy **Grow Lead Inbox API** = a simple token-authed JSON POST (name, contact, message, source). | Grow intake forms/pipelines; Manage has documents API + **Maildrop** (per-matter email address). | Free dev account; app-directory listing via partner review, no listing fee found. | Most-used all-rounder among small CA firms; already our named analogy target. | High | **Low** (Lead Inbox) → Med (full Platform app) | Low — we push an organized record *after the worker chooses the firm* | **Pilot-now** (Lead Inbox push + packet-to-Maildrop); directory app after-3-firms |
| **Filevine** | Well-documented API (projects, contacts, **documents**, notes) but **partner-gated**: outside developers must go through the Partnerships team; customers can self-generate keys for their own firm. | Intake runs through **Lead Docket** (Filevine-owned): own REST API, per-firm API key, maps custom fields into Filevine projects. | Partnership application; certified-partner program. | Strong in plaintiff/litigation-heavy firms, incl. larger CA employment shops. | High (for Filevine firms) | Med (gated, two APIs) | Low, **but** watch the funnel filter: we push *into* Lead Docket only when the worker picked that firm — we never become a Lead Docket lead *source* vendor | After-3-firms (a pilot firm on Filevine can lend its own API key sooner) |
| **Litify** | Salesforce-native; open API = the Salesforce API. Real integration = an ISV/AppExchange build. | Multi-channel intake objects; DocuSign/Adobe Sign native. | Salesforce ISV program overhead (security review, rev share). | Enterprise plaintiff firms; few solo/mid-size CA employment shops. | Low for our segment | High | Low | Later |
| **MyCase** | Public API (since 2023) + App Bar marketplace. | Intake forms, client portal, email-in. | Partner application to AffiniPay; no fee found. | Common with solos/small firms. | Med | Med | Low | After-3-firms (via Zapier first) |
| **Smokeball** | Stable REST API (matters, contacts, **documents**, comms) as of Jan 2026; marketplace.smokeball.com; API-scope request form. | Forms + email/doc ingestion. | Partner enquiry + scope approval. | Small-firm general practice; lighter plaintiff-employment presence. | Low-Med | Med | Low | Later |
| **PracticePanther** | Open API + deep **Zapier** integration (1,000+ apps). | Intake forms; Zapier in/out both directions. | Self-serve via Zapier. | User-friendly mid-tier; some CA solos. | Med | **Low** (ride Zapier) | Low | After-3-firms (covered by one Zapier build) |
| **CASEpeer** | API exists but only on the **Advanced plan**; Zapier connector; Dropbox/OneDrive/QuickBooks native. | PI-specific intake. | Plan-gated, not partner-friendly. | PI-first, not employment. | Low | Med | Low | Later |
| **Lawmatics** | REST API (OAuth2), Make/Zapier connectors; direct partnerships (Filevine, CARET). | It IS the intake CRM — forms, e-sign, docs. | Partner program; API is public. | The intake-CRM layer some target firms already pay for. | Med-High | Med | **Low but sensitive**: Lawmatics is a *funnel product* — sync must stay "worker-chosen record → firm's Lawmatics matter," never "one3seven as a Lawmatics lead source" | After-3-firms |
| **Lead Docket** | Own REST API (per-firm key); LeadsAI. | Leads from forms/chat/calls → scored → Filevine projects. | Comes with Filevine relationship. | See Filevine row. | — | — | Same funnel caveat as Lawmatics | After-3-firms |
| **Neos (Assembly)** | Open API, developer-platform positioning; DocuSign/O365/OneDrive native; Integration Partner Program. | Forms + doc automation. | Partner application. | PI-leaning; 2,600+ firms. | Low | Med | Low | Later |
| **MerusCase** *(add — not on original list)* | Public developer guide + API endpoints docs. | Dedicated **Employment tab** and employment-form merge fields. | Docs are public; partner terms unclear. | **The** CA employment/workers-comp specialist PMS — likely over-represented in our exact segment. Worth a discovery question in every firm call. | High (if our firms use it) | Med | Low | Validate in discovery **pilot-now**; build after-3-firms |

**Cheapest dashboard-killer of all (no API):** every major PMS accepts **email-in filing** (Clio Maildrop per-matter addresses, MyCase/Smokeball/Neos equivalents). one3seven can email the finished packet PDF straight into the firm's matter file. Zero partnership, zero API, works for every platform on day one. Doctrine risk: none (it's the same packet the firm already downloads).

## 2. Generic connectors

- **Zapier (primary), Make (Lawmatics), n8n (self-host/cost)** — one Zapier app makes one3seven reachable from PracticePanther, MyCase, CASEpeer, Lawmatics, Clio, Google/Outlook Calendar, Sheets, Slack without ten bespoke builds. Trigger: "organized record shared with firm" → firm's PMS. Doctrine: payload = record link + facts on file, nothing evaluative. **(a) Med-High, (b) Med, (c) low, (d) after-3-firms.**
- **Inbound "send-to-intake" email address** (ours): each worker (and each firm code) gets `record-xyz@in.one3seven.com`; forwarded paystubs/schedules/HR emails land in the worker's record with provenance = the email itself. Mirrors the Maildrop pattern firms already understand; feeds the extraction engine we already shipped (.txt/scanned-PDF). **(a) High for workers, (b) Med (inbound parse — Resend/Postmark webhook, infra partly exists), (c) none, (d) pilot-now.**
- **Calendar (Google/Outlook)**: push key dates (records-request response windows, appointment dates) as calendar events. One-way push only; never read the user's calendar at pilot. **(a) Low-Med, (b) Low (ICS file = zero API; OAuth push later), (c) low — deadlines must stay "estimated"/informational per gap-detection doctrine, (d) later; ICS download pilot-now.**

## 3. Worker-side document sources

What workers actually have: phone photos, Gmail attachments, a Drive folder, employer-portal PDFs.

- **Google Drive Picker / Dropbox Chooser / OneDrive File Picker** — all three are free, mature, drop-in JS pickers; the provider handles auth and the worker explicitly selects files (privacy-clean: no broad Drive scope). This is what comparable consumer products use. **(a) High (workers' #1 friction), (b) Low, (c) none, (d) pilot-now.**
- **Gmail/Outlook attachment import** (OAuth mailbox scope) — powerful but heavy: Google restricted-scope verification + a privacy posture we shouldn't take on yet. The send-to-intake address (§2) gets 80% of the value with none of the scope burden. **(d) later.**
- **Phone scan** — don't integrate; rely on native iOS/Android scan-to-PDF + our shipped chunked scanned-PDF extraction. Add a "how to scan" helper screen, not an SDK. **(d) pilot-now (copy only).**

## 4. E-signature rails (records-request letters)

For §226(b)/§1198.5 records-request letters, most letters are *mailed/emailed to employers* — signature by the worker only, so a full e-sign rail may be overkill at pilot (typed signature + PDF works).

- **Dropbox Sign API**: $100/mo ≈ 100 signature requests, free in test mode, simplest embed. Best fit if/when we want real e-sign.
- **DocuSign API**: ~$75/mo for ~40 envelopes, annual billing, heavier program — brand recognition is the only advantage.
**Recommendation:** typed-signature PDF pilot-now; Dropbox Sign after-3-firms if firms ask for signed intake/engagement flows. Doctrine: none (letters are worker-owned records requests; counsel already reviews templates).

## 5. What competitors integrate with

- **Eve (eve.legal)** — the deepest integrator in our space: matter/doc sync with **Clio, Litify, SmartAdvocate, GrowPath**, plus RingCentral/Zoom Phone/Dialpad for calls. Signal: plaintiff firms *expect* PMS sync; Eve validates Clio + Litify as the two rails that matter. Note Eve syncs *firm* data into Eve — we'd sync *worker-owned* records out to firms. Different direction, same rails.
- **Darrow** — portfolio platform for firms; announced Microsoft integration (Copilot in Teams, Purview). Enterprise-flavored; not our segment's rails.
- **Atticus** — no public API/integrations; it's a consumer *funnel* (match → fee share). Instructive as the model our distribution filter explicitly rejects: the worker enters *their* funnel. We integrate so the worker's chosen firm receives the record — the opposite flow.
- **EverSettled** — no public integration marketplace or API surfaced in 2026 searches; appears closed-loop.
- **Clio's own ecosystem** — 250+ apps; Grow connects Gmail, Outlook, Zapier, LawPay (intake → engagement → retainer in one flow). Being *in* that directory is distribution, not funnel-capture: the firm installs us, the worker still chose the firm.

---

## Top 5 first integrations (recommendation)

| # | Integration | Kills which complaint | Effort | Doctrine risk | Phase |
|---|---|---|---|---|---|
| 1 | **Packet-to-PMS via email-in** (Clio Maildrop et al.) — firm clicks "file to matter," we email the packet into their system | Firm: "another dashboard to check" — works on *every* PMS with zero API | **Very low** | None (same packet firms already download) | **Pilot-now** |
| 2 | **Worker cloud-file pickers** (Drive + Dropbox + OneDrive) | Worker: "my documents are scattered" — biggest ingestion friction | Low | None | **Pilot-now** |
| 3 | **Send-to-intake email address** (worker forwards evidence in) | Worker: "how do I get this email/paystub in?" — plus provenance for free | Med | None | **Pilot-now** |
| 4 | **Clio Grow Lead Inbox push → full Clio Platform app** | Firm: "re-key the intake into Clio" — start with the simple token POST, graduate to an App Directory listing (distribution) | Low → Med | Low (record push only, worker-initiated, no merit data) | Pilot-now (push) / After-3-firms (directory app) |
| 5 | **Zapier app** | Long tail: PracticePanther, MyCase, Lawmatics, CASEpeer, calendars, Sheets — one build, many rails | Med | Low (payload discipline enforced in the connector) | After-3-firms |

**Deferred deliberately:** Filevine/Lead Docket partnership (gated — unless a pilot firm lends its own key), Litify (Salesforce ISV weight), Gmail OAuth import (scope burden), e-sign rail (Dropbox Sign when firms ask), MerusCase (validate usage in discovery calls first — could jump the queue if our CA employment firms live there).

*Sources consulted (Aug 2026): Clio developer docs (Platform, Grow Lead Inbox, Maildrop), Filevine/Lead Docket partner + API docs, MyCase App Bar coverage (LawSites), Smokeball API docs + marketplace, PracticePanther/Zapier, CASEpeer plan docs, Lawmatics API/integrations pages, Assembly Neos partner program, MerusCase developer guide, Eve.legal integrations pages, Darrow launch coverage (LawSites/BusinessWire), Atticus lawyer FAQ, Google Picker / Dropbox Chooser / OneDrive Picker docs, DocuSign & Dropbox Sign API pricing pages.*
