/**
 * Reference content for the founder CRM "Scripts & objections" tab and weekly targets.
 *
 * NOTE: This is a first-draft cheat sheet grounded in the 30MPC cold-calling framework and the
 * one3seven value prop. Replace with the founder's finalized script/objections/email before
 * relying on it in the field. Internal-only — never shown to workers or firms.
 */

export const CRM_WEEKLY_TARGETS = {
  firms: 100,
  calls: 50,
  emails: 50,
  demos: 3,
  pilots: 1,
} as const;

export const CRM_CALL_SCRIPT: { step: string; text: string }[] = [
  {
    step: 'Opener (permission-based)',
    text: '“Hi [Attorney], this is [Rep] with one3seven — I know I’m an interruption. Can I have 30 seconds, and you can tell me whether it’s worth continuing?”',
  },
  {
    step: 'Reason for the call (the problem)',
    text: '“We work with California employment firms who lose unbilled hours assembling a worker’s scattered records before they can even evaluate the matter. one3seven hands you an organized, source-linked intake before the first call.”',
  },
  {
    step: 'How it works (one line)',
    text: '“The worker uploads their pay stubs, HR complaints, write-ups — one3seven organizes them into a timeline and a categorized packet. It organizes; it never gives legal advice or decides the matter. You evaluate.”',
  },
  {
    step: 'The ask (a look, not a sale)',
    text: '“I’m not asking you to buy anything. Would you be open to a 15-minute look at a sample organized intake to tell me if it would save you time? Worst case, you tell me it’s not for you.”',
  },
  {
    step: 'Close to a specific time',
    text: '“Does Thursday at 9, or Friday at 2 work better?”',
  },
];

export const CRM_OBJECTIONS: { objection: string; response: string }[] = [
  {
    objection: '“We already have an intake process / case management system.”',
    response: 'one3seven sits before that — it organizes the worker’s raw records into a clean intake so your existing system starts with structure instead of a pile of PDFs. It feeds your process, it doesn’t replace it.',
  },
  {
    objection: '“Is this AI giving legal advice / making the call for me?”',
    response: 'No. one3seven organizes and reflects — it never concludes. It doesn’t score claims or tell anyone they have a case. Every legal judgment stays with you; everything it surfaces links back to the source document for your review.',
  },
  {
    objection: '“I don’t have time for this.”',
    response: 'That’s exactly the point — it’s built to give you time back. The look is 15 minutes, and if it doesn’t obviously save you intake hours, you’ll know fast and we’re done.',
  },
  {
    objection: '“How much does it cost?”',
    response: 'The pilot is free — no card, limited time. We’re looking for feedback from a few firms, not a sale. Pricing comes later and only if it’s clearly saving you time.',
  },
  {
    objection: '“Just send me some information.”',
    response: 'Happy to — and the fastest way to know if it’s relevant is 15 minutes looking at a real organized intake together. Can I send the one-pager and grab a short slot so it’s not just another email in your inbox?',
  },
];

export const CRM_COLD_EMAIL = `Subject: organized intakes before your first call — quick look?

Hi [Attorney],

Quick one. California employment firms tell us the same thing: the first consult gets eaten by assembling a worker's scattered records — pay stubs, HR complaints, write-ups — before the matter can even be evaluated.

one3seven hands you that intake already organized: a source-linked timeline and categorized records, before the first call. It organizes records — it doesn't give legal advice or decide the matter. You evaluate.

We're running a free pilot with a few California firms. Worth a 15-minute look at a sample intake to see if it saves you time?

[Rep]
one3seven · one3seven.com`;
