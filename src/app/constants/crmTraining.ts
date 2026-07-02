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
    'Goal of the call is one thing: book a 15-minute screen-share demo. Not pricing, not a subscription — just the appointment. Free 7-day pilot, no credit card.',
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
      { id: 'stripe-products', label: 'Create the Stripe prices: Practice $249, Firm $549, Surge $1,490 (annual)', why: 'These are the plans already in the app; Stripe needs matching products to bill them.' },
      { id: 'stripe-env', label: 'Add the Stripe price IDs to the app settings (env vars)', why: 'VITE_STRIPE_PRICE_PRACTICE / FIRM / SURGE — this “lights up” the paid plans so firms can subscribe.' },
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

/** What a firm pays — the monthly subscription tiers reps are selling. */
export const CRM_SUBSCRIPTION_TIERS = [
  { tier: 'Practice', price: '$249 / month', detail: 'Up to 20 intakes · 2 seats · standard processing' },
  { tier: 'Firm', price: '$549 / month', detail: 'Up to 60 intakes · 5 seats · priority processing' },
  { tier: 'Surge', price: '$1,490 / month (annual only)', detail: 'Unlimited intakes · unlimited seats · dedicated onboarding · firm-branded packets' },
  { tier: 'Enterprise', price: 'Custom', detail: 'Contact info@one3seven.com' },
];

export const CRM_COMMISSIONS = {
  headline: 'Commission — 20% recurring, every month the firm stays',
  intro:
    '20% recurring monthly commission on every firm you close — paid every month that firm stays active. No salary, no draw, no base. You earn when a firm converts and keep earning every month they stay. Your incentive is tied to retention, not just the close — so you have a reason to make sure the firm actually uses the product and stays.',
  perTier: [
    { tier: 'Practice', price: '$249/mo', perMo: '$49.80/mo', perYr: '$597.60/yr' },
    { tier: 'Firm', price: '$549/mo', perMo: '$109.80/mo', perYr: '$1,317.60/yr' },
    { tier: 'Surge', price: '$1,490/mo', perMo: '$298.00/mo', perYr: '$3,576.00/yr' },
  ],
  compounding: [
    { firms: '1 firm', mix: 'Firm ($549)', mo: '$109.80', yr: '$1,318' },
    { firms: '3 firms', mix: '1 Practice + 2 Firm', mo: '$269.40', yr: '$3,233' },
    { firms: '5 firms', mix: '2 Practice + 2 Firm + 1 Surge', mo: '$617.20', yr: '$7,406' },
    { firms: '10 firms', mix: '4 Practice + 4 Firm + 2 Surge', mo: '$1,234.40', yr: '$14,813' },
  ],
  terms: [
    'When you get paid: monthly, within 5 business days of one3seven receiving the firm’s subscription payment.',
    'How long you earn: every month the firm stays active on a paid plan. If a firm cancels, commission stops that month.',
    'What triggers a close: the firm signs up for a paid plan through your outreach and you are the documented source.',
    'Free pilot firms: no commission during the free 7-day pilot — commission starts when the firm converts to a paid plan.',
    'Chargebacks: if a firm’s payment fails and is not recovered, that month’s commission is not paid.',
    'Tax: you are an independent contractor, responsible for all taxes on commission income.',
  ],
  notOffered: ['Salary or guaranteed draw', 'Equity or ownership for sales activity', 'Expense reimbursement', 'Benefits or employment status'],
  note:
    'Independent contractor commission arrangement offered by One3Seven Ventures LLC (an entity submitted for formation in California and pending review). A formal independent contractor agreement will be provided and signed before any sales activity begins.',
};
