# one3seven — Auth & Role Architecture

> **Rewritten 2026-08-20.** The previous version of this document described in-memory,
> unauthenticated "auth" (no real password hashing, no persisted sessions) as the current state
> and real auth as a future requirement. That's backwards — real Supabase Auth has been in place
> for some time. This version describes what's actually live.

## Auth is real Supabase Auth, not a simulation

`src/lib/supabaseClient.ts` creates the one Supabase client the whole app shares, configured with
`persistSession: true` and `autoRefreshToken: true` — sessions are real, backed by Supabase's own
JWT/refresh-token mechanism, and survive a page reload. Password hashing, email verification,
password-reset flows, and OAuth are all Supabase's, not hand-rolled.

`AuthWelcomeScreen` → `SignInScreen` / `CreateAccountScreen` are still the entry screens, but they
call real `supabase.auth.signInWithPassword()` / `supabase.auth.signUp()` under the hood (via
`intakeDataService.ts`), not a simulated in-memory flow.

## Role is a real column, not client state you can set yourself

`profiles.role` (`'worker' | 'firm' | null`) is what determines which experience a signed-in user
sees — `RoleSelectionScreen`'s firm tile only renders `if (allowFirmRole)`, and `allowFirmRole` is
`profile?.role === 'firm'`: a brand-new signup never even sees the option, because their profile
role isn't `'firm'` yet.

Critically, **a client cannot set its own `role` to `'firm'`**. A DB trigger
(`enforce_profile_privilege_lock`, migration `20260817220000_close_self_serve_firm_signup.sql`,
plus a second trigger locking `firm_profiles.firm_code` on insert) rejects any user-initiated
attempt to do this at the database level — not just hidden in the UI, actually refused by
Postgres. Firm accounts exist only because the founder provisioned one by hand via the Supabase
dashboard; there's no self-serve firm signup and no admin UI for it. `/for-firms` reflects this
honestly: it's a lead-capture form and an email address, not a signup page.

`crm_role` (`'rep'` or unset) and `is_founder` are separate boolean/text fields on the same
`profiles` row, used to gate the internal founder CRM (`/hq`) — see `CrmAccessGate.tsx`, which is
backed by RLS, not just a client-side check.

## Single login, no separate worker/firm experience

`SignInScreen`/`CreateAccountScreen` are the same components for every user — there's no
`/firm-login` route or separate firm authentication flow. `onFirmSignIn` in `App.tsx` only sets a
client-side "intent" flag (which screen to route to on success); the code has its own comment
making explicit that this intent is never a security boundary. Whether someone actually gets
firm-side access is entirely a function of their `profiles.role`, which — per above — they cannot
set themselves.

## What actually gates each surface

- **Worker screens** — any authenticated user with `role !== 'firm'` (effectively everyone who
  signs up, since new accounts default away from firm).
- **Firm screens** (`LawFirmDashboardScreen`, `IntakeReviewScreen`, `FirmSettingsScreen`) —
  `profile.role === 'firm'`, which only exists for founder-provisioned accounts.
- **Founder CRM** (`/hq`, `FounderCRMScreen`) — `profile.is_founder` or `profile.crm_role ===
  'rep'`, checked both client-side (for routing) and server-side (RLS on the underlying
  `crm_firms`/`crm_activity` tables, and a server-side re-check inside the `chat-assistant` edge
  function specifically because its system prompt carries confidential sales data).
- **A given intake's data** — RLS on `intakes`/`uploaded_files`/`intake_summaries`, scoped to the
  owning `worker_id`, or to a firm whose `intake_routes` row has reached `full_access` for that
  intake. See `ARCHITECTURE.md` for the data-access side of this.

## What this document intentionally does not claim

This isn't a full security audit — for known open findings (CRM row-ownership gaps, RLS spot
checks, etc.) see `security_curriculum` and `project_founder_hq_crm` in the project memory rather
than treating this file as the current risk register. This document's job is just to describe the
mechanism accurately so a new engineer isn't misled by an out-of-date one.
