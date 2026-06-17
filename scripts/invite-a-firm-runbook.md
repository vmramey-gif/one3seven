# Invite a Firm — Beta Runbook

Goal: get a firm from zero to seeing their first routed intake, reliably and repeatably.
Grounded in the real code path (App.tsx auth handlers, FirmSettingsScreen, firm-directed `/?fc=` intake).

> Key reality: the public marketing site is an **invite-only wall** during beta. The "For attorneys" /
> "Start free pilot" buttons open an informational modal, **not** signup. Do NOT send firms there to
> sign up. Use the path below.

Estimated time: **firm setup ~5 min**; **first routed intake end-to-end ~15–20 min** (includes one worker test submission).

---

## 0. One-time operator checks (do once, before any invite)

| Check | Where | What you want |
|---|---|---|
| Supabase env configured | Vercel (prod) | Already true (prod works). |
| **"Confirm email" setting** | Supabase → Auth → Providers → Email | ✅ **CONFIRMED OFF** (verified 2026-06-16). Firms sign in immediately — no email confirmation step. If this ever changes to ON, Step 2 gains an email-confirm gate (see note). |
| **Site URL / redirect** | Supabase → Auth → URL Configuration | ✅ **CONFIRMED** `https://one3seven.com`. Magic links and redirects return to the app correctly. |
| Email deliverability | Supabase → Auth (SMTP) | Not needed for firm sign-in (Confirm email is OFF). Still required for the **worker magic-link** step (Step 5). Send yourself a test; check spam. |

---

## 1. Provision the firm account  — **YOU**
There is no clean self-serve signup link, so create the account yourself for control:

1. Supabase dashboard → **Auth → Users → Add user** → enter the firm's email + a temporary password.
   (Or "Invite user" if you prefer the email-invite flow + "Confirm email" ON.)
2. Send the firm a short handoff (see **Handoff template** below): the app URL, their email, the temp password, and "click **Sign in**."

> Alternative (self-serve): the firm can create their own account via `one3seven.com → Sign in → Back → Create Account`. Functional, but there's no direct deep link, so Option 1 is cleaner.

## 2. Firm signs in  — **FIRM**
1. Go to `https://one3seven.com` → **Sign in** → email + password.
2. **No email-confirmation step** — "Confirm email" is OFF, so the firm is signed in immediately and goes straight to role selection.
   _(If "Confirm email" is ever turned ON later, this step gains a "check your email to confirm, then sign in" gate.)_

## 3. Choose role  — **FIRM**
First sign-in → **Role Selection** → pick **Firm**.

## 4. Complete Firm Settings → get the firm code  — **FIRM**
1. App routes a new firm to **Firm Settings** automatically.
2. Enter the **firm name** → **Save**. On save, a **firm code** is assigned and a shareable link appears:
   `https://one3seven.com/?fc=<FIRM_CODE>`
3. Copy that link — it's the firm's entire distribution mechanism.
4. App moves to the **Firm Dashboard**.

## 5. Route a worker to the firm  — **YOU (test) or FIRM**
The dashboard is empty until a worker submits through the firm's link.
1. Open the firm's `/?fc=<FIRM_CODE>` link (use a test worker email you control for the first run).
2. Worker enters email → receives a **magic-link** email → clicks it → returns to the app.
3. Worker completes the guided intake and submits.

## 6. Firm sees the routed intake  — **FIRM**
Firm Dashboard → the submitted intake appears → open it → review → **Download** the prestige PDF packet.

---

## What can go wrong, and how to recover

| Step | Symptom | Cause | Recovery |
|---|---|---|---|
| 1–2 | "Service unavailable" / signup blocked | Supabase env not configured | Verify Vercel env vars; prod should already be configured. |
| 2 | (Confirm email is OFF — no email step for firm sign-in.) | — | If a confirm gate ever appears, someone turned "Confirm email" back ON in Supabase. |
| 4 | "Firm profile saved without a firm code. Save again to assign your code." | First save didn't mint a code | **Save again.** Confirm the code + `/?fc=` link now show. |
| 3–4 | Role saved but no firm settings / dashboard | Profile-commit timeout fallback | Re-pick the role / refresh; verify a `firm_profiles` row exists in Supabase. |
| 5 | Worker magic-link email doesn't arrive | Deliverability | Check spam; resend; confirm Site URL = one3seven.com so the link returns to the app. |
| 6 | Dashboard empty after a worker submitted | No routed intake yet, or RLS scoping | Confirm the worker actually submitted via the firm's `/?fc=` link (not a generic intake); verify the intake route is linked to this firm. |

---

## Handoff template (what you send the firm)

> Subject: Your one3seven beta access
>
> You're set up on one3seven (controlled beta).
> 1. Go to https://one3seven.com and click **Sign in**.
> 2. Email: `<their email>`  ·  Temporary password: `<temp pw>`
> 3. Choose **Firm**, enter your firm name, and **Save** — you'll get your firm code and a shareable intake link.
> 4. Share that link with a worker; their organized intake will appear in your dashboard for review.
> Reply here if anything doesn't work and we'll jump in.

---

## Notes / open items affecting this flow
- **#1 entry is invite-only by UI design.** If you later want firm self-serve, surface a "Create firm account" route from the marketing page (today it dead-ends at the beta modal).
- **Confirmed config (2026-06-16):** "Confirm email" OFF, Site URL `https://one3seven.com`. Firm sign-in is immediate.
- **Dashboard RLS:** confirm a fresh firm sees its routed intakes and only its own (see the security/RLS notes in project memory).
