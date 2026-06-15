# one3Seven - Final MVP QA Checklist

Use for beta verification. **Pass** means no dead clicks, no demo data when `VITE_SHOW_DEV_GALLERY` is unset, and navigation matches intent.

## Global

- G1: `npm run build` succeeds.
- G2: Gallery / dev screen map only when `VITE_SHOW_DEV_GALLERY=true`.
- G3: Worker and firm **Sign out** clears local state, calls Supabase `signOut` when configured, lands on **Auth Welcome**.
- G4: Product notices still state one3Seven is not a law firm (see `ONE3SEVEN_NOTICES`).

## Auth

- **AuthWelcome**: Sign In, Create Account, firm sign-in link all navigate.
- **SignIn / CreateAccount**: Back to welcome; form submits; Google shows calm placeholder until OAuth is wired.
- **Role selection**: Back to welcome; Worker to landing; Firm to firm dashboard.

## Worker

- **Landing**: Signed-in worker gets law-firm modal before upload; Enter firm code vs Continue without routes upload firm gate correctly; Timeline/Summary give feedback if not available; hub Settings/Sign out work; logo returns to dashboard when `onGoWorkerDashboard` passed.
- **Upload**: Back, firm gate / skip per prior choice, Settings/Sign out when passed.
- **Processing / Summary**: Back paths, Download + Print summary, share flows unchanged in intent.
- **Timeline / File preview / How it works**: Back or home path works.
- **Worker settings**: Sections present; Sign out works.

## Firm

- **Dashboard**: FIRM CODE line always visible (live: code or em dash; non-live demo: EXAMPLE123 + note); tabs and Sign out work; empty state copy matches spec.
- **Intake review**: Live load without mock flash; download button shows clear placeholder toast.
- **Firm settings**: Back to dashboard; placeholders for team/security/billing.

## End-to-end tests

1. Worker: welcome to sign-in to role to landing to modal to upload to processing to summary to landing; sign out.
2. Firm: welcome to dashboard to intake review to back; sign out.
3. Firm code: modal Enter path then validate on Begin organizing; Continue without skips gate.
4. Participating: only via explicit share action on summary (unchanged).
5. PDF: summary Download + Print (browser).

## Copy

- No harsh rejection language in UI; workflow wording stays calm.

## Known TODOs

- Wire Google OAuth in Supabase when ready.
- Firm intake review download can later reuse worker summary export.
- Stripe when connected.
