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
  {
    objection: '“Why don’t you just sell me cases / leads instead?”',
    response: 'We deliberately don’t — selling cases per-lead runs into attorney referral and fee-splitting rules (California is strict), and it would put your firm in an awkward spot. one3seven is a software tool you license: it organizes the worker’s own records into a review-ready intake, and the worker controls sharing. You stay fully in charge of who you take on. Same time savings, none of the ethics exposure.',
  },
  {
    objection: '“So how do intakes get to me — are you a referral service?”',
    response: 'No — we’re a software tool, not a referral service. You share your own intake link with your own clients; they self-serve through a guided intake, and you get a review-ready, source-linked record in your dashboard. We don’t match, rank, or steer anyone to you, and you pay a flat subscription — never per client. The worker controls their records; you control what you take.',
  },
  {
    objection: '“We already use Eve / another legal AI.”',
    response: 'Different lane. Eve is an enterprise platform — long onboarding, and it leans into drafting and analysis, which edges toward the UPL line. one3seven is organize-only and fast: one intake link, the worker self-serves, and you get a structured, source-linked intake in minutes — so you move faster because the record’s already built. Ten-minute setup, not a 90-day implementation. We never draft, predict, or conclude — you decide.',
  },
];

export const CRM_COLD_EMAIL = `EMAIL 1 — opener (Day 0)
Subject: organized employment intakes — free pilot for [Firm]

Hi [First name],

Plaintiff employment clients often arrive with records scattered across pay stubs, texts, HR emails, and memory — and someone has to spend unbilled time assembling it before the matter can even be reviewed.

one3seven organizes a worker's employment records into a structured, source-linked intake packet: a clear timeline, categorized records, and surfaced dates where each fact traces back to the original document.

It organizes and reflects. It does not draw legal conclusions. You evaluate everything.

We're opening a free 7-day pilot to a small number of California employment firms — no credit card required. You can see what it produces here:

https://www.one3seven.com/for-firms

Worth a look? I'd be happy to organize one real intake for free so you can review the output against your own records.

— [Name]
one3seven
[email] · https://one3seven.com
[mailing address]
Reply "stop" and I won't follow up.

———

EMAIL 2 — the gift (Day 4, reply on the same thread)

Hi [First name] — a simpler offer than a demo.

Send me your next messy intake — the pile of pay stubs, texts, and HR emails. I'll return it as an organized, source-linked packet within 24 hours. No call, no commitment. If it's useful, we talk; if not, you've lost nothing.

— [Name]

———

EMAIL 3 — break-up (Day 9)

Hi [First name], I'll stop here so I'm not cluttering your inbox.

If organizing intake before it reaches an attorney's desk is ever worth 15 minutes, the free pilot is here: https://www.one3seven.com/for-firms. I'll leave the door open.

— [Name]

———

HOW TO RUN IT
• Personalize the first line of Email 1 per firm (practice focus, a recent win). Generic = deleted.
• One CTA per email. Send from a person (name@one3seven.com), not info@.
• CAN-SPAM: every email needs a real mailing address (PO box / business — never a home address) and an honest opt-out.
• Keep the wording: "organizes and reflects — it does not draw legal conclusions." That's the UPL guardrail. Don't let it drift into outcome or claim language.`;

// ── Competitive & credibility talking points (mirrors the Ask AI knowledge for reps
// who'd rather read than query). Rule: only raise a competitor if the prospect does;
// state facts, never trash-talk, then pivot to our lane. ────────────────────────────
export const CRM_CREDIBILITY: string[] = [
  'Built on Anthropic’s Claude — the same AI platform California adopted statewide for its own agencies. Strongest said out loud on a call.',
  'Safe to say: "built on / powered by Anthropic’s Claude" and the California-adopted line. NOT safe: "partner," "certified," "endorsed," any government-affiliation implication, or logos.',
  'Pair it with our own line (needs no permission): "one3seven only organizes and reflects — it never concludes." First borrows California’s credibility; second is ours.',
];

export const CRM_COMPETITORS: { name: string; when: string; say: string }[] = [
  {
    name: 'Eve Legal',
    when: 'They use / are weighing Eve (or "what about Eve?")',
    say: 'Different lane. Eve leans into AI drafting/analysis — the "authoring" lane that edges toward the UPL line and is where the IP fights are (it was sued for patent infringement in June 2026). Drafting tools produce convincing-but-unverified output — the kind that has gotten lawyers sanctioned. We don’t draft or conclude; we organize what already exists and link every fact to its source, so there’s nothing to hallucinate. ~10-minute setup vs. long enterprise onboarding.',
  },
  {
    name: 'Clio / MyCase',
    when: 'We already use Clio (or MyCase)',
    say: 'Great — keep it. Those manage your practice after intake. one3seven sits in front of them: it organizes the client’s scattered records into a source-linked intake so what lands in Clio is already clean. Complementary, not a replacement. (Clio is also mid-consolidation — the ~$1B vLex/Fastcase deal plus the Alexi antitrust fight — so some firms are wary of lock-in; we’re narrow and additive.)',
  },
];

export const CRM_WHY_AI_LOVE_HATE: string[] = [
  'Attorneys DISLIKE AI that talks to their clients — conversational intake bots feel robotic; clients give one-word answers and resent it.',
  'Attorneys LOVE AI that does the back-office — organizing documents, timelines, summaries.',
  'one3seven is the loved kind: no bot pretending to be the firm. The worker uploads their own records; we organize them.',
];

export const CRM_SPECIALTIES: string[] = [
  'Source-linked intake packet — every fact links to its exact source doc/page (verify in one click).',
  'Dated timeline / chronology built from the records and the worker’s account.',
  'Document categorization — wage/pay, HR & complaints, communications, discipline, separation.',
  'Information-gap surfacing — "additional information that may help" (never "weak" or "missing evidence").',
  'Document checklist — requested vs. received, at a glance.',
  'Time-sensitive date flags for attorney review (never determines the deadline).',
  'Section 8B wage-exposure estimate (Firm & Surge, California only) — arithmetic from records, attorney work-product, never "damages."',
  'Firm dashboard — review-ready intakes; open and decide in minutes.',
  'Firm intake link — share one link with your clients; the organized intake lands in your dashboard.',
  'Worker control — the worker owns their records and decides what and who to share.',
  'Scope: California fully supported; Texas organize-only pending regulatory review.',
];
