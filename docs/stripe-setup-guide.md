# one3seven — Stripe Setup Guide (get to "can take money")

*Click-by-click to make the billing path live, wired to the exact env vars this codebase reads. Includes the
low-fee strategy (annual-by-ACH, wire for enterprise, card surcharge). ⚠️ Read "Code reconciliation needed"
at the bottom first — the backend is stale relative to the current 3 tiers.*

---

## What the code expects (so we set the right things)
- **Frontend** (`billingService.ts`) reads three price IDs from Vercel env:
  `VITE_STRIPE_PRICE_PRACTICE`, `VITE_STRIPE_PRICE_FIRM`, `VITE_STRIPE_PRICE_SURGE`.
- **Backend** — two Supabase edge functions: `create-checkout-session` (opens Stripe Checkout) and
  `stripe-webhook` (maps the paid price → `plan_id`, writes the firm's `subscriptions` row).
- Backend secrets it reads: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL`,
  `STRIPE_PRICE_PRACTICE`, `STRIPE_PRICE_FIRM` (+ Surge — see reconciliation note).

---

## Step 1 — Create the Stripe account
1. Go to stripe.com → create an account under **One3Seven Ventures LLC** (use the business EIN + bank account).
2. Complete business verification (needed before you can accept live payments).
3. Stay in **Test mode** while wiring; flip to **Live** only when you're ready to charge a real firm.

## Step 2 — Create the 3 products + prices
In **Product catalog → Add product**, create three, each with a **recurring** price:

| Product | Price | Billing period |
|---|---|---|
| one3seven Practice | $249 | monthly |
| one3seven Firm | $549 | monthly |
| one3seven Surge | **$17,880** billed **yearly** | Surge is **$1,490/mo, billed annually** — the yearly Stripe price must be **1,490 × 12 = $17,880**, NOT $1,490. Creating it at $1,490/yr undercharges by 12×. |

**Tip (fees):** also add a **second annual price** to Practice and Firm (e.g., Firm $6,588/yr) so firms can
choose annual — that's the cheap rail (see Step 6).

After saving each price, copy its **Price ID** (looks like `price_1AbC...`). You'll have 3 (or up to 5 with
the annual options).

## Step 3 — Wire the frontend price IDs (Vercel)
In Vercel → your project → **Settings → Environment Variables**, add:

```
VITE_STRIPE_PRICE_PRACTICE = price_...   (Practice monthly)
VITE_STRIPE_PRICE_FIRM     = price_...   (Firm monthly)
VITE_STRIPE_PRICE_SURGE    = price_...   (Surge yearly)
```
Redeploy the frontend so they take effect.

## Step 4 — Set the backend secrets (Supabase)
In Supabase → **Project Settings → Edge Functions → Secrets** (or `npx supabase secrets set`), add:

```
STRIPE_SECRET_KEY     = sk_...            (from Stripe → Developers → API keys)
STRIPE_WEBHOOK_SECRET = whsec_...         (from Step 5)
APP_URL               = https://one3seven.com   (your live app URL)
STRIPE_PRICE_PRACTICE = price_...
STRIPE_PRICE_FIRM     = price_...
STRIPE_PRICE_SURGE    = price_...         (see reconciliation note — code may need this added)
```

## Step 5 — Point the webhook at your function
1. Stripe → **Developers → Webhooks → Add endpoint.**
2. URL: `https://<your-project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Events to send: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted` (at minimum).
4. Copy the **Signing secret** (`whsec_...`) → that's your `STRIPE_WEBHOOK_SECRET` in Step 4.
5. Deploy the functions (operator step):
   `npx supabase functions deploy create-checkout-session --project-ref ebgkomrujmrkpetcdbgp`
   `npx supabase functions deploy stripe-webhook --project-ref ebgkomrujmrkpetcdbgp`

## Step 6 — Turn on the low-fee rails
- **Enable ACH debit:** Stripe → **Settings → Payment methods → ACH Direct Debit** (turn on). ACH is
  ~0.8% capped at **$5** vs ~2.9% on cards.
- **Push annual + ACH as the default/best price.** One annual ACH charge hits the $5 cap **once** instead of
  12× — a $6,588 Firm year costs ~$5 in fees (~0.08%).
- **Wire for enterprise/Surge:** put bank/wire instructions on large invoices; ask your bank to waive
  **incoming** wire fees.
- **Card surcharge (optional, CA-compliant):** you may add a card surcharge (disclosed, capped at your cost)
  so card-payers cover the ~3%. Present it as "ACH/wire — free · card +3%." Follow CA disclosure + card-network
  rules (confirm with counsel).

## Step 7 — Test, then go live
1. In **Test mode**, run a checkout with a Stripe test card (`4242 4242 4242 4242`).
2. Confirm the webhook fires and the firm's `subscriptions.plan_id` flips to the right tier.
3. Switch Stripe to **Live**, swap the live price IDs/keys into the same env vars, redeploy.

---

## ⚠️ Code reconciliation needed (before checkout fully works)
The backend edge functions currently reference **legacy tier names that no longer exist**
(`STRIPE_PRICE_SOLO`, `STRIPE_PRICE_PRACTICE_PLUS`, `STRIPE_PRICE_FIRM_PLUS`) and **do not appear to wire
`STRIPE_PRICE_SURGE`.** Your live tiers are **practice / firm / surge**. Before checkout works end-to-end:

1. Update `create-checkout-session` and `stripe-webhook` to map the **current** three tiers
   (practice/firm/surge) and drop the legacy solo/plus names.
2. Related: the wage-exposure gate (`firmTierIncludesDamagesFeature`) also checks nonexistent
   `practice_plus`/`firm_plus` — reconcile the tier names in one pass (with counsel sign-off, since
   wage-exposure is counsel-gated).

*I can make these code edits when you're ready — it's a small, contained change, and it's the difference
between "Stripe is set up" and "a firm can actually complete checkout on the right plan."*
