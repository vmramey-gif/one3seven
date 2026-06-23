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

export const CRM_COMMISSIONS = {
  headline: 'Commission — paid after a free demo converts',
  intro:
    'You earn commission when a firm you worked converts to a PAID plan after the free 30-day pilot. The free demo and the pilot are not commissionable on their own — commission is tied to a paid conversion.',
  // PLACEHOLDERS — founder to replace with the real, agreed figures.
  lines: [
    'Demo booked: [SET BY FOUNDER] (e.g., flag only, no payout)',
    'Pilot started (free 30-day): [SET BY FOUNDER]',
    'Paid conversion after pilot: [SET BY FOUNDER — e.g., $___ flat and/or ___% of first-year subscription]',
    'Payout timing: [SET BY FOUNDER — e.g., after the firm’s first paid invoice clears]',
  ],
  note:
    'DRAFT — these figures are placeholders, not a contract. The founder sets the actual commission plan; nothing here is binding until confirmed in writing.',
};
