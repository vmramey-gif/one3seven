# Security audit — data-access / authorization layer (2026-07-25)

Scope: all 7 edge functions, all RLS migrations, the new storage policy, Stripe webhook, chat
assistant, and client-side auth boundaries. Product handles vulnerable workers' sensitive records,
so the #1 concern is cross-tenant access (one firm/worker reading another's data).

## Bottom line
The core cross-tenant and privilege-escalation attacks are **already defended**: RLS is on every
sensitive table, firms read worker records only through worker-owned full-access routes scoped to
their own firm, route grants flow through worker-gated RPCs, the Stripe webhook verifies signatures,
and the storage policy we just added is soundly scoped. **A firm cannot read another firm's intakes,
and cannot self-grant full access.** Two issues should be fixed before real workers' data goes in
front of real firms (both addressed below); one is a latent trap that detonates when preview routing
ships.

---

## Findings & remediation

### #1 — HIGH — "full-access-only" hardening is a no-op (dead policy names) → FIX WRITTEN
A 2026-06-18 migration meant to restrict firm reads of `intake_summaries` / `timeline_events` to
full-access routes DROP-ed policy names that don't exist, leaving the loose 2026-06-07 policies
(`intake_summaries_select_firm` / `timeline_events_select_firm`, which allow a read on ANY route)
still live. Masked today (all routes are full_access); becomes a real leak the moment
participating-**preview** routing is enabled — a preview-stage firm could read a worker's full
summary/timeline, bypassing the app-layer preview redaction.

- **Fix:** migration `supabase/migrations/20260725120000_security_audit_hardening.sql` drops the loose policies.
- **Operator:**
  1. VERIFY first (files may have diverged from prod):
     ```sql
     select policyname, cmd, qual from pg_policies
     where tablename in ('intake_summaries','timeline_events') order by tablename, policyname;
     ```
     Confirm the loose `*_select_firm` policies exist and a strict `*_full_access_only` policy is present.
  2. Apply the migration (SQL Editor, or `npx supabase db push`).
  3. Re-run the query; confirm only the full-access-only firm-read policies remain.
- **HARD GUARDRAIL:** do NOT flip `PARTICIPATING_ROUTING_LIVE` / enable preview routing until this is
  confirmed closed in production. (It's already off pending counsel — keep it off until this too.)

### #2 — MEDIUM — extract-document-facts authorized the wrong ID → FIX WRITTEN
Single-file mode authorized on the caller-supplied `intake_id` but processed the caller-supplied
`uploaded_file_id` without checking the file belongs to the caller. Exploitable only if an attacker
knows a victim's random file UUID (not enumerable), but the authz was bound to the wrong key.

- **Fix:** patched `supabase/functions/extract-document-facts/index.ts` — single-file mode now looks
  up the file by id, confirms `worker_id = auth.uid()`, and uses the STORED path/name (never
  caller-supplied) before any service-role read.
- **Operator:** redeploy the `extract-document-facts` edge function.

### #3 — LOW/MEDIUM — worker can directly INSERT a full_access route → DO NOT quick-fix (would break firm-code direct access)
A worker can `insert` a route row `{intake_id: own, firm_id: any, route_status:'full_access'}`
directly, bypassing `route_intake_to_firm_code`. Only over-shares the worker's OWN data to a chosen
firm (no cross-tenant read); firms cannot do this.

⚠ **The obvious fix is unsafe.** Adding `and route_status <> 'full_access'` to the worker INSERT
policy would break a LEGITIMATE, core flow: `intakeDataService.ts` `ensureLinkedFirmPreviewRoute`
(~line 2686) inserts a `full_access` route **directly from the client** for the firm-code
"Direct full review access" path. Blocking full_access on INSERT would make firm-code direct
access fail. So this is NOT a drop-in migration.

**Proper fix (deferred — low value vs. cost):** move that client-side full_access insert into a
`SECURITY DEFINER` RPC (mirroring `route_intake_to_firm_code`) that validates the firm-code linkage
server-side, THEN harden the INSERT policy to forbid client-set full_access. Given the issue is
LOW severity (worker's OWN data only, no cross-tenant read) and the fix is a real refactor that
risks a working flow, recommend leaving as-is for now and revisiting when the routing layer is
next touched. Do not ship the naive policy change.

### #4 — INFO — verify base `intake_routes` policies against the live DB
The `intake_routes` table DDL / some policies live partly outside the repo. Confirm no
over-permissive (`using (true)`) SELECT/INSERT policy exists:
```sql
select policyname, cmd, qual, with_check from pg_policies where tablename = 'intake_routes';
```

---

## Confirmed SOLID (no action)
- **stripe-webhook** — verifies Stripe signature before trusting payload. ✅
- **create-checkout-session / create-portal-session** — JWT + `firm_profiles.id = X AND profile_id = auth.uid()`; checkout allowlists priceId. ✅
- **get-intake-intelligence** — JWT → getUser → firm full_access route check before service-role read. ✅
- **storage policy `intake_files_firm_full_access_read`** — path-parsed intakeId matched against the caller's OWN full-access routes; crafted-path cross-tenant read not achievable. ✅
- **notify-pilot-lead** — shared-secret gated, fixed recipient, HTML-escaped. ✅
- **chat-assistant** — authenticated, no DB reads, no per-user data; injection can't exfiltrate records. ✅
- **Base RLS** — `intakes`/`uploaded_files`/`profiles` worker-only; CRM tables founder-only; route view is `security_invoker` with scoped RLS. ✅
