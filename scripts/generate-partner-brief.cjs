const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'one3seven-partner-brief.pdf');
const doc = new PDFDocument({ size: 'LETTER', margin: 0, autoFirstPage: true });
doc.pipe(fs.createWriteStream(OUT));

const W   = 612;
const H   = 792;
const ML  = 50;
const TW  = W - ML * 2;

// ── PALETTE (matches one3Seven app) ─────────────────────────────────────────
const NAVY    = '#1E1B4B';
const INDIGO  = '#6366F1';
const PURPLE  = '#6D4AFF';
const LAVBG   = '#F6F2FF';
const LIGHT   = '#EEF2FF';
const BORDER  = '#E7E1FF';
const WHITE   = '#FFFFFF';
const GRAY    = '#6B7280';
const DARK    = '#111827';
const SUBDUED = '#1E1B4B';
const GREEN   = '#059669';
const AMBER   = '#D97706';
const LILAC   = '#A5B4FC';

// ── HELPERS ──────────────────────────────────────────────────────────────────
function pageHeader(title, subtitle, pageNum) {
  // Full-width navy bar
  doc.rect(0, 0, W, 72).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(WHITE).text('one3Seven', ML, 18);
  doc.font('Helvetica').fontSize(9).fillColor(LILAC).text(title, ML, 42);
  // page badge
  doc.rect(W - 90, 22, 40, 18).fill(PURPLE);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
     .text(`${pageNum} of 6`, W - 90, 27, { width: 40, align: 'center' });
  if (subtitle) {
    doc.font('Helvetica').fontSize(8).fillColor('#4F46E5')
       .text(subtitle, W - 170, 42, { width: 120, align: 'right' });
  }
}

function pageFooter() {
  doc.rect(0, H - 28, W, 28).fill(INDIGO);
  doc.font('Helvetica').fontSize(8).fillColor(WHITE)
     .text('one3Seven  ·  one3seven-beta.vercel.app  ·  hello@one3seven.com', ML, H - 18, { width: TW, align: 'center' });
}

function sectionLabel(label, y) {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INDIGO)
     .text(label, ML, y, { characterSpacing: 1.2 });
  doc.moveTo(ML, y + 12).lineTo(W - ML, y + 12).strokeColor(LIGHT).lineWidth(0.75).stroke();
  return y + 20;
}

function heading(text, y, size = 18) {
  doc.font('Helvetica-Bold').fontSize(size).fillColor(NAVY).text(text, ML, y, { width: TW });
  return y + doc.heightOfString(text, { width: TW }) + 6;
}

function body(text, y, opts = {}) {
  doc.font('Helvetica').fontSize(10).fillColor('#374151')
     .text(text, ML, y, { width: TW, lineGap: 2.5, ...opts });
  return y + doc.heightOfString(text, { width: TW, lineGap: 2.5, ...opts }) + 10;
}

function callout(text, y, color = PURPLE) {
  const innerW = TW - 32;
  const h = doc.heightOfString(text, { width: innerW, lineGap: 2.5 }) + 26;
  doc.rect(ML, y, TW, h).fill(LIGHT);
  doc.rect(ML, y, 4, h).fill(color);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(NAVY)
     .text(text, ML + 16, y + 13, { width: innerW, lineGap: 2.5 });
  return y + h + 14;
}

function bullet(text, y) {
  doc.circle(ML + 7, y + 5, 2.5).fill(PURPLE);
  doc.font('Helvetica').fontSize(9.5).fillColor('#374151')
     .text(text, ML + 18, y, { width: TW - 18, lineGap: 2 });
  return y + doc.heightOfString(text, { width: TW - 18, lineGap: 2 }) + 7;
}

function chip(text, x, y, bg, fg) {
  const w = doc.widthOfString(text, { fontSize: 8 }) + 18;
  doc.rect(x, y, w, 16).fill(bg);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(fg).text(text, x + 9, y + 4, { width: w });
  return x + w + 6;
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 — COVER
// ─────────────────────────────────────────────────────────────────────────────
// Full-bleed navy top half
doc.rect(0, 0, W, 380).fill(NAVY);

// Logo / wordmark
doc.font('Helvetica-Bold').fontSize(42).fillColor(WHITE).text('one3Seven', ML, 70, { width: TW, align: 'center' });
doc.font('Helvetica').fontSize(14).fillColor(LILAC).text('Public Overview & Partner Brief', ML, 126, { width: TW, align: 'center' });

// Divider
doc.moveTo(W / 2 - 30, 158).lineTo(W / 2 + 30, 158).strokeColor(PURPLE).lineWidth(2).stroke();

// Date + audience
doc.font('Helvetica').fontSize(10).fillColor('#C7D2FE')
   .text('Prepared: June 10, 2026', ML, 172, { width: TW, align: 'center' });
doc.font('Helvetica').fontSize(9.5).fillColor('#818CF8')
   .text('For: Jimmy · Wes · Future Partners · Trusted Advisors', ML, 192, { width: TW, align: 'center' });

// Hero callout card floating over the color break
const cardY = 300;
doc.rect(ML, cardY, TW, 80).fill(WHITE).stroke(BORDER);
doc.rect(ML, cardY, 4, 80).fill(PURPLE);
doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY)
   .text('A clear, factual overview for trusted legal-tech contacts,', ML + 16, cardY + 12, { width: TW - 32 });
doc.font('Helvetica').fontSize(10.5).fillColor(GRAY)
   .text('potential partners, advisors, and future collaborators.', ML + 16, cardY + 34, { width: TW - 32 });
doc.font('Helvetica').fontSize(9).fillColor(PURPLE)
   .text('Intentionally plain and direct — no overselling, no legal claims.', ML + 16, cardY + 54, { width: TW - 32 });

// Three signal chips
const chipY = 430;
doc.font('Helvetica').fontSize(9.5).fillColor(GRAY)
   .text('What this document covers:', ML, chipY, { width: TW });
let cx = ML;
const chipRowY = chipY + 18;
for (const [label, bg, fg] of [
  ['What it is', LIGHT, PURPLE],
  ['Who it helps', '#F0FDF4', GREEN],
  ['Current stage', '#FFFBEB', AMBER],
  ['How to help', LIGHT, INDIGO],
]) {
  const cw = doc.widthOfString(label) + 20;
  doc.rect(cx, chipRowY, cw, 22).fill(bg);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(fg).text(label, cx + 10, chipRowY + 6);
  cx += cw + 8;
}

// Bottom note
doc.font('Helvetica').fontSize(8.5).fillColor(GRAY)
   .text('This document is for early trusted conversations only. Share thoughtfully.', ML, 530, { width: TW, align: 'center' });

pageFooter();

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 — EXEC SUMMARY + SIMPLE EXPLANATION + WHY IT EXISTS
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageHeader('Public Overview & Partner Brief', 'Executive Summary', 2);
let y = 92;

y = sectionLabel('EXECUTIVE SUMMARY', y);
y = heading('What one3Seven Does', y, 16);
y = body('one3Seven is a legal intake and case-readiness platform built to help workers organize employment-related stories, documents, timelines, and records before a law firm reviews the matter.', y);
y = body('The platform does not replace an attorney, does not give legal advice, and does not decide whether a claim exists. Its purpose is to make the earliest stage of legal intake cleaner, faster, and easier for both the worker and the firm.', y);
y = callout('The company question now is no longer only: Can we build it?\nThe more important question is: Will firms actually adopt it?', y);
y = body('The product is currently in beta. The core workflow exists — worker intake, document upload, firm-side review, timeline organization, and additional document requests. The next stage is focused on firm trust, firm adoption, review speed, and conversion.', y);
y += 8;

y = sectionLabel('THE SIMPLE EXPLANATION', y);
y = heading('One sentence.', y, 14);

// Big statement card
doc.rect(ML, y, TW, 52).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(13).fillColor(WHITE)
   .text('one3Seven turns scattered worker records into a structured intake packet a law firm can review.', ML + 16, y + 10, { width: TW - 32 });
y += 64;

y = body('A worker may start with paystubs, texts, emails, HR complaints, write-ups, schedules, termination records, screenshots, and a confusing story. one3Seven helps organize that into a cleaner review experience for a firm.', y);
y = callout('one3Seven is not trying to be the lawyer. It is trying to make the first review more organized.', y, GREEN);
y += 6;

y = sectionLabel('WHY IT EXISTS', y);
y = body('Employment intake is often messy at the exact moment clarity matters most. Before a firm can evaluate a matter, someone needs to answer:', y);

// Two-column question grid
const qLeft  = ['Who is the worker?', 'When did employment begin and end?', 'What documents exist?', 'What is still missing or unclear?'];
const qRight = ['Who was the employer?', 'What happened, and in what order?', 'Which events are supported by records?'];
const colW2  = TW / 2 - 6;
for (let i = 0; i < Math.max(qLeft.length, qRight.length); i++) {
  if (qLeft[i]) {
    doc.circle(ML + 7, y + 5, 2.5).fill(INDIGO);
    doc.font('Helvetica').fontSize(9.5).fillColor(DARK).text(qLeft[i], ML + 16, y, { width: colW2 - 16 });
  }
  if (qRight[i]) {
    doc.circle(ML + colW2 + 19, y + 5, 2.5).fill(INDIGO);
    doc.font('Helvetica').fontSize(9.5).fillColor(DARK).text(qRight[i], ML + colW2 + 28, y, { width: colW2 - 16 });
  }
  y += 18;
}
y += 4;
y = body('one3Seven is being built around this intake gap.', y);

pageFooter();

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 3 — WHO IT HELPS + HOW IT WORKS
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageHeader('Public Overview & Partner Brief', 'Who It Helps · How It Works', 3);
y = 92;

y = sectionLabel('WHO IT HELPS', y);

const personas = [
  { role: 'Workers', color: PURPLE, desc: 'People who need a guided way to tell their story, upload employment-related records, and organize what happened before a firm reviews it.' },
  { role: 'Law Firms', color: INDIGO, desc: 'Plaintiff-side employment firms that need cleaner review packets and faster early triage.' },
  { role: 'Intake Teams', color: GREEN, desc: 'Intake managers, case managers, and legal administrators who spend time chasing missing documents, sorting records, and preparing matters for attorney review.' },
  { role: 'Referral & Legal-Service Partners', color: AMBER, desc: 'Trusted operators who need a better way to organize, route, or evaluate early worker inquiries.' },
];

for (const p of personas) {
  const descH = doc.heightOfString(p.desc, { width: TW - 130, lineGap: 2 });
  const rowH  = Math.max(40, descH + 22);
  doc.rect(ML, y, TW, rowH).fill(LAVBG).stroke(BORDER).lineWidth(0.5);
  doc.rect(ML, y, 4, rowH).fill(p.color);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text(p.role, ML + 14, y + 10, { width: 108 });
  doc.font('Helvetica').fontSize(9.5).fillColor('#374151').text(p.desc, ML + 130, y + 10, { width: TW - 140, lineGap: 2 });
  y += rowH + 5;
}
y += 12;

y = sectionLabel('HOW IT WORKS', y);
y = body('The worker enters their story and uploads supporting records. one3Seven organizes the information into a structured review experience. The firm can review the intake packet, timeline, uploaded documents, current understanding, and missing information.', y);
y = callout('The platform shows what is known, what is supported by records, and what still needs clarification. The goal is not to decide the matter — it is to create a better starting point for human review.', y);

// Two-column worker/firm side
const colW3 = TW / 2 - 8;

// Worker side card
doc.rect(ML, y, colW3, 148).fill(LIGHT).stroke(BORDER).lineWidth(0.5);
doc.rect(ML, y, 4, 148).fill(PURPLE);
doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text('WORKER SIDE', ML + 12, y + 10, { characterSpacing: 0.8 });
let wy = y + 26;
for (const b of ['Tell their story in a guided way.', 'Upload documents and records.', 'Add employer, date, and event context.', 'Respond to document requests.', 'See that information is organized.', 'Understand what is shared with firms.']) {
  doc.circle(ML + 19, wy + 4, 2).fill(PURPLE);
  doc.font('Helvetica').fontSize(9).fillColor(DARK).text(b, ML + 26, wy, { width: colW3 - 34 });
  wy += 17;
}

// Firm side card
const fx = ML + colW3 + 16;
doc.rect(fx, y, colW3, 148).fill(LIGHT).stroke(BORDER).lineWidth(0.5);
doc.rect(fx, y, 4, 148).fill(INDIGO);
doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY).text('FIRM SIDE', fx + 12, y + 10, { characterSpacing: 0.8 });
let fy2 = y + 26;
for (const b of ['Review worker and employer information.', 'See employment dates and record counts.', 'Review uploaded files by category.', 'Read an organized timeline of events.', 'Review clarification needs.', 'Accept, decline, or request more documents.']) {
  doc.circle(fx + 19, fy2 + 4, 2).fill(INDIGO);
  doc.font('Helvetica').fontSize(9).fillColor(DARK).text(b, fx + 26, fy2, { width: colW3 - 34 });
  fy2 += 17;
}
y += 160;

pageFooter();

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 4 — WHAT MAKES IT DIFFERENT + CURRENT STAGE + WHAT IS BUILT
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageHeader('Public Overview & Partner Brief', 'What Is Different · Current Stage', 4);
y = 92;

y = sectionLabel('WHAT MAKES ONE3SEVEN DIFFERENT', y);
y = body('one3Seven is not just a contact form. It is not just file storage. It is not trying to be a legal conclusion machine.', y);
y = body('The difference is the organization layer: one3Seven converts messy worker input into a structured intake packet that supports faster, clearer firm review.', y);
y = callout('The product value is simple: reduce intake chaos before a firm spends serious time reviewing the matter.', y);
y += 8;

y = sectionLabel('CURRENT STAGE', y);
y = body('one3Seven is currently in beta with a live demo environment and a working firm-side review experience. The current priority is not broad marketing — it is careful validation with trusted people who understand law firms, legal marketing, intake operations, and employment law workflows.', y);

// Big question card
doc.rect(ML, y, TW, 48).fill(NAVY);
doc.font('Helvetica').fontSize(10).fillColor(LILAC).text('The key question for this stage:', ML + 16, y + 8, { width: TW - 32 });
doc.font('Helvetica-Bold').fontSize(14).fillColor(WHITE).text('Why should this firm care?', ML + 16, y + 22, { width: TW - 32 });
y += 60;
y = body('Every screen, demo, and early conversation should answer that question.', y);
y += 8;

y = sectionLabel('WHAT IS ALREADY BUILT', y);

const builtCols = [
  ['Worker intake flow', 'Worker story collection', 'Document upload flow', 'Firm review queue', 'Firm intake review screen', 'Structured intake snapshot', 'Timeline organization'],
  ['Current understanding section', 'Uploaded records review', 'Document request flow', 'Worker document response', 'Worker ↔ firm notifications', 'Demo mode', 'Live beta URL'],
];

const bColW = TW / 2 - 6;
const bStartY = y;
for (let col = 0; col < 2; col++) {
  let by = bStartY;
  const bx = col === 0 ? ML : ML + bColW + 12;
  for (const item of builtCols[col]) {
    doc.rect(bx, by, 10, 10).fill(GREEN);
    doc.font('Helvetica').fontSize(9).fillColor(DARK).text(item, bx + 14, by + 1, { width: bColW - 16 });
    by += 16;
  }
  y = Math.max(y, by);
}
y += 8;

pageFooter();

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 5 — STILL IMPROVING + 60-DAY DISCIPLINE + ADOPTION QUESTIONS
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageHeader('Public Overview & Partner Brief', 'Product Discipline · Adoption Questions', 5);
y = 92;

y = sectionLabel('WHAT IS STILL BEING IMPROVED', y);
y = body('one3Seven is early and should be presented honestly as an early beta. The most important improvements are not random features — they are improvements that increase firm trust, firm adoption, firm review speed, and firm conversion.', y);

const improving = [
  'The intelligence layer', 'Timeline accuracy and clarity', 'Document extraction reliability',
  'Firm review clarity', 'Worker guidance', 'Attorney-safe language',
  'Demo readiness', 'Security verification', 'Reducing placeholder language',
  'Ensuring the app never sounds like it gives legal conclusions',
];
// 2-col layout
const impColW = TW / 2 - 6;
for (let i = 0; i < improving.length; i++) {
  const ix = i % 2 === 0 ? ML : ML + impColW + 12;
  const iy = y + Math.floor(i / 2) * 17;
  doc.circle(ix + 5, iy + 5, 2.5).fill(AMBER);
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK).text(improving[i], ix + 14, iy, { width: impColW - 14 });
}
y += Math.ceil(improving.length / 2) * 17 + 14;

y = sectionLabel('60-DAY PRODUCT DISCIPLINE', y);

doc.rect(ML, y, TW, 58).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE)
   .text('For the next 60 days, no feature should be built unless it improves:', ML + 16, y + 10, { width: TW - 32 });
let cx2 = ML + 16;
for (const [label, color] of [['Firm trust', LIGHT], ['Firm adoption', LIGHT], ['Review speed', LIGHT], ['Firm conversion', LIGHT]]) {
  const lw = doc.widthOfString(label) + 18;
  doc.rect(cx2, y + 32, lw, 16).fill(PURPLE);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE).text(label, cx2 + 9, y + 36);
  cx2 += lw + 6;
}
y += 70;
y = body('Everything else goes into the future roadmap. This keeps the company focused on the real adoption question instead of drifting into features that do not help firms say yes.', y);
y += 8;

y = sectionLabel('THE ADOPTION QUESTIONS', y);
y = body('The best early conversations should be built around truth — not compliments. Ask these:', y);

const aqs = [
  ['If this fails, why does it fail?', PURPLE],
  ['Who inside a firm feels the intake pain most?', INDIGO],
  ['What would need to be true for you to introduce this to a firm contact?', GREEN],
  ['What would make a firm trust this?', GREEN],
  ['What would make a firm ignore this?', AMBER],
  ['Who is the buyer, who is the user, and who blocks adoption?', PURPLE],
];

for (const [q, color] of aqs) {
  const qh = doc.heightOfString(q, { width: TW - 28, lineGap: 2 });
  const cardH = qh + 16;
  doc.rect(ML, y, TW, cardH).fill(LAVBG).stroke(BORDER).lineWidth(0.5);
  doc.rect(ML, y, 3, cardH).fill(color);
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK).text(q, ML + 14, y + 8, { width: TW - 28, lineGap: 2 });
  y += cardH + 5;
}

pageFooter();

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 6 — WHY IT MATTERS + ROADMAP + HOW TO HELP + TRUST NOTE
// ─────────────────────────────────────────────────────────────────────────────
doc.addPage();
pageHeader('Public Overview & Partner Brief', 'Why It Matters · How to Help', 6);
y = 92;

y = sectionLabel('WHY THIS MATTERS', y);
y = body('The earliest stage of a legal matter is where many people get lost. Workers may not know how to present what happened. Firms may not have time to untangle every messy intake. Useful facts can be buried in screenshots, payroll records, emails, or memory.', y);
y = body('A stronger intake packet can help firms review faster, help workers feel more clearly understood, and reduce wasted time on both sides.', y);
y = callout("The goal is a cleaner handoff between a worker's story and a firm's review process.", y, GREEN);
y += 4;

y = sectionLabel('WHERE ONE3SEVEN IS GOING', y);

// Near-term vs long-term two cards
const cardHalf = TW / 2 - 6;
doc.rect(ML, y, cardHalf, 82).fill(LIGHT).stroke(BORDER).lineWidth(0.5);
doc.rect(ML, y, 4, 82).fill(PURPLE);
doc.font('Helvetica-Bold').fontSize(9).fillColor(PURPLE).text('NEAR TERM', ML + 12, y + 9, { characterSpacing: 0.8 });
doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
   .text('Make employment-law intake dramatically cleaner for workers and law firms. Pilot firms. Proof of adoption.', ML + 12, y + 24, { width: cardHalf - 20, lineGap: 2 });

const rtx = ML + cardHalf + 12;
doc.rect(rtx, y, cardHalf, 82).fill(LIGHT).stroke(BORDER).lineWidth(0.5);
doc.rect(rtx, y, 4, 82).fill(INDIGO);
doc.font('Helvetica-Bold').fontSize(9).fillColor(INDIGO).text('LONG TERM', rtx + 12, y + 9, { characterSpacing: 0.8 });
doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
   .text('Broader legal-readiness infrastructure — medical records, exhibit organization, transcript support, trial-prep. Future possibilities, not current priority.', rtx + 12, y + 24, { width: cardHalf - 20, lineGap: 2 });
y += 96;

y = sectionLabel('HOW SOMEONE CAN HELP', y);
y = body('The most useful help right now is specific feedback from people who understand legal intake, law firm operations, legal marketing, employment law, referral networks, or legal tech sales.', y);

const helpItems = [
  ['Review the demo and give honest feedback.', PURPLE],
  ['Explain how firms currently handle intake.', INDIGO],
  ['Identify what attorneys would distrust.', AMBER],
  ['Suggest which role inside a firm would care most.', INDIGO],
  ['Pressure-test whether firms would pay, pilot, or ignore it.', AMBER],
  ['Make one thoughtful introduction to the right legal or intake contact.', GREEN],
  ['Help shape language that sounds credible to law firms.', GREEN],
];

for (const [item, color] of helpItems) {
  doc.circle(ML + 7, y + 5, 2.5).fill(color);
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK).text(item, ML + 18, y, { width: TW - 18, lineGap: 2 });
  y += 17;
}
y += 8;

y = sectionLabel('TRUST AND BOUNDARY NOTE', y);
y = body('one3Seven is not a law firm, does not provide legal advice, and does not replace attorney review. The platform is built to support organization, intake readiness, and firm-side review. This overview should be shared thoughtfully with trusted contacts only.', y);
y += 4;

// Final statement card
doc.rect(ML, y, TW, 62).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(10.5).fillColor(WHITE)
   .text('one3Seven has moved from a build question to an adoption question.', ML + 16, y + 10, { width: TW - 32 });
doc.font('Helvetica').fontSize(10).fillColor(LILAC)
   .text('The next breakthrough is likely to come from honest conversations with people who know how real firms think, buy, hesitate, and adopt.', ML + 16, y + 30, { width: TW - 32, lineGap: 2 });
y += 74;

pageFooter();

doc.end();
console.log('Partner brief PDF written to', OUT);
