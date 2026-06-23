/**
 * Rep training content for the CRM "Training" tab (internal-only). First-draft, editable.
 * The PI rules reflect one3seven's hard scope boundaries — keep them intact. Commission
 * figures are PLACEHOLDERS for the founder to set; nothing here is a contractual comp plan.
 */

export const FIRE_DEMO_TRAINING = {
  link: 'one3seven.com/fire-demo',
  intro:
    'The fire demo (Marcus Reyes — a worker displaced by the Tracy/Medline warehouse fire) is your most emotionally resonant walkthrough. Use it for firms working California fire-displaced workers. Run it on your phone or screen-share — it is a full click-through.',
  // This block is the most important framing — it must stay front and center.
  employmentFocus:
    'EVERYTHING you show a firm here is EMPLOYMENT. The fire is only the human context — it explains why the worker’s records are scattered or lost. The matter you are organizing is employment: wages, hours, missed breaks, termination, and what happened after the worker raised a concern. Pitch one3seven to EMPLOYMENT firms as: “it organizes a displaced worker’s employment records into a clean intake before they ever reach your desk.”',
  steps: [
    { title: '1. Set the scene (don’t sensationalize the fire)', text: 'Lead with the problem you solve: a displaced worker has employment records scattered across phone, email, and lost paperwork. The fire is why it’s a mess — not the pitch itself.' },
    { title: '2. Story step', text: 'Point out the reassurance line (“you don’t have to do this all at once”). The product is gentle for someone in crisis — attorneys notice that this lowers the worker’s barrier to organizing.' },
    { title: '3. Add records + the sourcing helper', text: 'This is the fire-specific magic: “Don’t have your records handy?” points the worker to EDD, IRS transcripts, HR/email — and records come in tagged “Recovered via EDD / email.” Show how a worker who lost everything still builds a real file.' },
    { title: '4. Organized summary + timeline', text: 'The payoff: scattered PDFs become a clean, dated, source-linked employment timeline. Emphasize that every entry links back to the original document for the attorney’s own review.' },
    { title: '5. Settlement beat', text: 'The strategic peak: the settlement offer is organized alongside everything else, so the worker can take the full picture to an attorney before deciding anything. one3seven organizes — it does not advise.' },
    { title: '6. Where these records can go', text: 'The worker-facing handoff names the attorney type (employment). This is what lands an organized intake in front of an employment firm — your buyer.' },
  ],
  theAsk:
    'Goal of the call is one thing: book a 15-minute screen-share demo. Not pricing, not a subscription — just the appointment. Free 30-day pilot, no credit card.',
};

export const PI_RULES = [
  {
    rule: 'Organizes, never concludes',
    detail: 'one3seven organizes records and reflects a timeline. It never decides whether anyone has a case, never scores a claim, never quotes damages. Do not say a worker “has a case” or imply an outcome — to a worker OR an attorney.',
  },
  {
    rule: 'The firm product is EMPLOYMENT-ONLY',
    detail: 'Never pitch one3seven to firms as a personal-injury or toxic-exposure tool. We organize employment records for employment attorneys. That is the entire firm-side offer.',
  },
  {
    rule: 'Fire injury / chemical exposure is OUT OF SCOPE',
    detail: 'Some fires involve injury or chemical exposure. That is not what we sell firms. If a worker has injury/exposure, the product’s own worker-facing handoff points THEM toward a personal-injury or toxic-tort attorney. You never market PI capability to firms, and you never collect or evaluate injury/medical matters.',
  },
  {
    rule: 'Banned vocabulary',
    detail: 'Never use: violation, owed/owes, entitled, liable/liability, strong/weak case, valid/invalid claim, “damages” as a verdict, or retaliation framed as a conclusion. Keep it to “organizes,” “reflects,” “for attorney review.”',
  },
  {
    rule: 'If an attorney asks “does it handle PI / exposure?”',
    detail: 'Say: “No — one3seven organizes employment records. It’s employment-focused and doesn’t evaluate or handle personal-injury or toxic-exposure matters.” Then steer back to the employment value.',
  },
];

/**
 * Founder-only launch checklist — the plain-English path from "built" to "charging customers."
 * Founder-facing only (reps never see it). Checkbox state persists in localStorage.
 */
export const LAUNCH_CHECKLIST: { group: string; items: { id: string; label: string; why: string }[] }[] = [
  {
    group: 'Legal & company — do these with a lawyer',
    items: [
      { id: 'llc', label: 'Finish forming One3Seven Ventures LLC', why: 'It’s submitted and pending. Confirm California approved it — until then there’s no liability shield protecting you personally.' },
      { id: 'upl', label: 'Have a lawyer review the product for “are we practicing law?” (UPL)', why: 'one3seven organizes, never concludes. A one-hour review confirms you’re on the right side of that line.' },
      { id: 'terms', label: 'Get the lawyer to finalize the Terms of Service & Privacy Policy', why: 'They’re published as drafts “pending review.” Counsel makes them final and binding.' },
      { id: 'rep-agreement', label: 'Put the rep commission plan in a written agreement', why: 'California requires a written commission agreement. Use the “first month” rule from the Training tab.' },
      { id: 'insurance', label: 'Look into E&O / liability insurance (optional but smart)', why: 'Standard protection for software that touches legal work.' },
    ],
  },
  {
    group: 'Payments — needed before you can charge firms',
    items: [
      { id: 'stripe-products', label: 'Create the Stripe prices: Solo $199, Practice $499, Firm $899', why: 'These are the plans already in the app; Stripe needs matching products to bill them.' },
      { id: 'stripe-env', label: 'Add the Stripe price IDs to the app settings (env vars)', why: 'VITE_STRIPE_PRICE_SOLO / PRACTICE / FIRM — this “lights up” the paid plans so firms can subscribe.' },
      { id: 'stripe-webhook', label: 'Turn on the payment webhook (stripe-webhook)', why: 'It’s built but not deployed yet. It flips a firm to “paid” automatically after they subscribe.' },
      { id: 'stripe-test', label: 'Test a checkout in Stripe test mode', why: 'Confirm a firm can actually subscribe end-to-end before you go live.' },
    ],
  },
  {
    group: 'Safety checks',
    items: [
      { id: 'rls', label: 'Run the CRM access check (RLS spot-check)', why: 'Confirms no worker, firm, or non-invited person can see your pipeline. Do this before reps load real data.' },
      { id: 'readiness-gate', label: 'Keep “Readiness”/exposure features demo-only until counsel signs off', why: 'They’re gated to the fire demo on purpose — don’t ship them to real users without a lawyer’s OK.' },
    ],
  },
];

export const CRM_COMMISSIONS = {
  headline: 'Commission — paid after a free demo converts',
  intro:
    'You earn commission when a firm you sourced converts to a PAID plan after the free 30-day pilot. The free demo and the pilot pay nothing on their own — commission is tied to a paid conversion and pays out after the firm’s first invoice clears.',
  rule: 'Your commission = the firm’s FIRST MONTH of subscription, paid once.',
  examples: [
    'Solo plan ($199/mo) → $199',
    'Practice plan ($499/mo) → $499',
    'Firm plan ($899/mo) → $899',
    'Enterprise (custom) → set per deal',
  ],
  rules: [
    'Paid on collection — after the firm’s first paid invoice clears, not at signature.',
    'Demos and free pilots are not commissionable. Only paid conversions count.',
    '60-day clawback — if the firm cancels within 60 days, the commission reverses.',
  ],
  note:
    'Paid billing is not live yet (beta pilots are free), so payouts begin once paid plans go live — build the pipeline now, get paid when firms convert. Commission terms must be confirmed in a written rep agreement before any payout (required in California).',
};
