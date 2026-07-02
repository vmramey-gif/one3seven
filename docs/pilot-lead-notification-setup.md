# Pilot-lead email notification — setup

Emails the founders the instant a firm submits the `/for-firms` "Start free pilot" form.
Flow: `pilot_interest` INSERT → Supabase **Database Webhook** → `notify-pilot-lead` edge function → **Resend** email.

The lead also still lands in the `/hq` CRM (priority-A card) via the DB trigger — this just adds a real-time push so you don't have to be looking at the CRM.

## Where the notification goes
To every address in the `PILOT_NOTIFY_TO` secret — set to **`victoria@one3seven.com`**
(add more, comma-separated, e.g. `victoria@one3seven.com,tadmor86@gmail.com`).
The email contains: name, firm, email (as a clickable reply-to), note, and submitted-at timestamp.

## One-time setup (operator — I do not deploy or handle keys)

### 1. Resend account + sender
- Sign up at https://resend.com (free tier is plenty for lead alerts).
- Verify a sending domain (`one3seven.com`) — or, just to test first, use the built-in `onboarding@resend.dev` as the FROM.
- Create an API key.

### 2. Generate a webhook shared secret (locally)
```bash
openssl rand -hex 32
```
Copy the output — it's used in both step 3 and step 5.

### 3. Set the function secrets (values never leave your machine / Supabase)
```bash
npx supabase secrets set \
  RESEND_API_KEY=<your-resend-key> \
  PILOT_NOTIFY_FROM="one3seven <alerts@one3seven.com>" \
  PILOT_NOTIFY_TO="victoria@one3seven.com" \
  PILOT_WEBHOOK_SECRET=<the-secret-from-step-2>
```
(If testing before domain verification, use `PILOT_NOTIFY_FROM="one3seven <onboarding@resend.dev>"`.)

### 4. Deploy the function
```bash
npx supabase functions deploy notify-pilot-lead --project-ref ebgkomrujmrkpetcdbgp
```

### 5. Create the Database Webhook (Supabase dashboard)
Database → **Webhooks** → Create:
- **Table:** `public.pilot_interest`
- **Events:** `INSERT` only
- **Type:** Supabase Edge Function → `notify-pilot-lead`
- **HTTP Headers:** add `x-webhook-secret` = the secret from step 2

### 6. Test
Submit the `/for-firms` form (or insert a test row into `pilot_interest`). You should get the email within seconds. Delete the test row afterward.

## Notes
- The function rejects any request without the correct `x-webhook-secret`, so the public function URL can't be used to spam you.
- If email fails, the CRM card is still created (the trigger and the webhook are independent) — you never lose a lead.
- To change recipients later, just re-run step 3 with a new `PILOT_NOTIFY_TO` (no redeploy needed).
