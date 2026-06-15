const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'one3seven-sales-bible.pdf');
const doc = new PDFDocument({ size: 'LETTER', margin: 0, autoFirstPage: true });
doc.pipe(fs.createWriteStream(OUT));

const W = 612;
const H = 792;
const NAVY   = '#1E1B4B';
const INDIGO = '#6366F1';
const LIGHT  = '#EEF2FF';
const WHITE  = '#FFFFFF';
const GRAY   = '#6B7280';
const DARK   = '#111827';
const GREEN  = '#059669';
const GOLD   = '#D97706';
const RED    = '#DC2626';

function pageHeader(title, subtitle) {
  doc.rect(0, 0, W, 72).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(22).fillColor(WHITE).text('one3Seven', 50, 18);
  doc.font('Helvetica').fontSize(10).fillColor('#A5B4FC').text(title, 50, 46);
  if (subtitle) {
    doc.font('Helvetica').fontSize(9).fillColor('#6366F1')
       .text(subtitle, W - 290, 50, { width: 240, align: 'right' });
  }
}

function sectionHeader(label, y) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INDIGO)
     .text(label, 50, y, { characterSpacing: 1.2 });
  const lineY = y + 14;
  doc.moveTo(50, lineY).lineTo(W - 50, lineY).strokeColor(LIGHT).lineWidth(1).stroke();
  return lineY + 10;
}

function bullet(x, y, color) {
  doc.circle(x, y + 5, 3).fill(color);
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 1 — THE PRODUCT & THE PROBLEM
// ═══════════════════════════════════════════════════════════════════════════
pageHeader('Sales Bible — Internal Use Only', 'Version 1.0 · June 2026');

let y = 90;

// The one sentence
doc.rect(50, y, W - 100, 44).fill(INDIGO);
doc.font('Helvetica-Bold').fontSize(13).fillColor(WHITE)
   .text(
     '"Before your attorney picks up the phone, one3Seven has already organized\nthe worker\'s documents, built the timeline, and flagged what\'s missing."',
     68, y + 8, { width: W - 136 }
   );
y += 56;

// The problem
y = sectionHeader('THE PROBLEM EVERY EMPLOYMENT FIRM ALREADY FEELS', y);

const problems = [
  ['Intake overload', 'Workers submit documents in every format. Someone has to sort through them before the attorney can even decide if the case is worth reviewing.'],
  ['$350/hr attorney time wasted', '3 hours organizing records before a consultation = $1,050 in unbillable attorney time. Every intake. Every time.'],
  ['Document chaos', 'Pay stubs, HR emails, warning letters, texts, schedules — scattered, unlabeled, out of order, across email threads and USB drives.'],
  ['Cases slipping through', 'High intake volume + limited review time = good cases declined because there was no time to evaluate them properly.'],
];

for (const [bold, rest] of problems) {
  bullet(56, y, RED);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
     .text(bold + '  ', 68, y, { continued: true, width: W - 118 });
  doc.font('Helvetica').fillColor(GRAY).text(rest);
  y += 26;
}

// What one3Seven does
y += 4;
y = sectionHeader('WHAT ONE3SEVEN DOES  —  IN PLAIN ENGLISH', y);

doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text(
     'A worker describes their situation and uploads their documents directly. one3Seven reads everything, ' +
     'builds a clean chronological timeline, categorizes the records, and flags anything that needs clarification. ' +
     'The attorney opens a single organized packet — not a pile of files.',
     50, y, { width: W - 100 }
   );
y += 46;

// The math
doc.rect(50, y, W - 100, 56).fill(LIGHT);
doc.rect(50, y, 5, 56).fill(GREEN);
doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY)
   .text('The math every managing partner understands:', 68, y + 8);
doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text('3 hours of attorney intake time  ×  $350/hr  =  $1,050 in cost per intake', 68, y + 26);
doc.font('Helvetica-Bold').fontSize(10).fillColor(GREEN)
   .text('one3Seven Practice plan: $499/month — unlimited intakes.  ROI on the first case.', 68, y + 42);
y += 68;

// What it is not
y = sectionHeader('WHAT ONE3SEVEN IS NOT  —  ANSWER THESE OBJECTIONS EARLY', y);

const notList = [
  ['Not a case management system', 'It does not replace Clio, MyCase, or any practice management software. It organizes intake before a case is opened.'],
  ['Not legal advice software', 'It never evaluates the case. It never tells the worker what to do. It organizes — the attorney decides.'],
  ['Not an AI that could be wrong about the law', 'It reads documents and builds timelines. No legal conclusions. No risk of unauthorized practice.'],
  ['Not a replacement for staff', 'It removes the sorting and organizing work. Staff can focus on the calls and relationships, not the document chaos.'],
];

for (const [bold, rest] of notList) {
  bullet(56, y, GOLD);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
     .text(bold + '  ', 68, y, { continued: true, width: W - 118 });
  doc.font('Helvetica').fillColor(GRAY).text(rest);
  y += 22;
}

// Footer
doc.rect(0, H - 36, W, 36).fill(NAVY);
doc.font('Helvetica').fontSize(8).fillColor('#6366F1')
   .text('one3Seven Sales Bible  ·  Page 1 of 3  ·  Internal Use Only', 50, H - 22, { width: W - 100, align: 'center' });

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 2 — THE BUYER & THE PROCESS
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
pageHeader('Sales Bible — Who Buys & How to Sell', 'Internal Use Only');
y = 90;

// Who buys
y = sectionHeader('WHO BUYS AT A LAW FIRM  —  REACH THE RIGHT PERSON', y);

const buyerRows = [
  { role: 'Managing Partner', pain: 'Revenue efficiency, firm growth, billable hour pressure', angle: '"Your attorneys stop doing intake sorting and start billing."', star: true },
  { role: 'Practice Manager / Ops Director', pain: 'Workflow burden, staff cost, intake volume', angle: '"This replaces $3–5k/month of intake coordinator work."', star: true },
  { role: 'Intake Director', pain: 'Document chaos, screening decisions, volume', angle: '"Every intake arrives organized. You review, you decide."', star: true },
  { role: 'Associate Attorney', pain: 'Too much non-billable intake work', angle: 'Not the buyer — but a strong internal champion if they love it.', star: false },
];

for (const row of buyerRows) {
  const bg = row.star ? LIGHT : '#F9FAFB';
  doc.rect(50, y, W - 100, 36).fill(bg);
  if (row.star) doc.rect(50, y, 4, 36).fill(INDIGO);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY)
     .text(row.role, 62, y + 4, { width: 130 });
  doc.font('Helvetica').fontSize(8.5).fillColor(GRAY)
     .text('Feels: ' + row.pain, 62, y + 18, { width: 130 });
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(row.star ? INDIGO : GRAY)
     .text(row.angle, 200, y + 12, { width: W - 260 });
  y += 38;
}

// ICP
y += 6;
y = sectionHeader('IDEAL CUSTOMER PROFILE  —  WHO TO TARGET FIRST', y);

const icpGood = [
  'Employment plaintiff law firm (worker-side only — not employer defense)',
  '1 to 15 attorneys',
  'High intake volume — 20 or more new inquiries per month',
  'California, New York, Illinois, Texas — highest employment litigation volume',
  'Currently using email, spreadsheets, or nothing to organize intakes',
];
const icpBad = [
  'Employer-side defense firms',
  'Criminal, family, or immigration law',
  'Large firms with a dedicated intake operations team already built',
];

const icpX = [50, 316];
const icpW = 256;

doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN).text('GOOD FIT', icpX[0], y);
doc.font('Helvetica-Bold').fontSize(9).fillColor(RED).text('NOT A FIT (YET)', icpX[1], y);
y += 14;

const icpMax = Math.max(icpGood.length, icpBad.length);
for (let i = 0; i < icpMax; i++) {
  if (icpGood[i]) {
    doc.circle(icpX[0] + 6, y + 5, 2.5).fill(GREEN);
    doc.font('Helvetica').fontSize(9).fillColor(DARK)
       .text(icpGood[i], icpX[0] + 14, y, { width: icpW - 14 });
  }
  if (icpBad[i]) {
    doc.circle(icpX[1] + 6, y + 5, 2.5).fill(RED);
    doc.font('Helvetica').fontSize(9).fillColor(DARK)
       .text(icpBad[i], icpX[1] + 14, y, { width: icpW - 14 });
  }
  y += 16;
}

// Discovery questions
y += 8;
y = sectionHeader('DISCOVERY QUESTIONS  —  ASK BEFORE YOU PITCH', y);

doc.font('Helvetica').fontSize(9.5).fillColor(GRAY)
   .text('Never pitch until you know the pain. Ask these in order:', 50, y);
y += 14;

const questions = [
  ['1', '"How does a new worker intake reach your firm today?"', 'Maps their current process — establishes baseline.'],
  ['2', '"Who touches it before an attorney reviews it?"', 'Finds the bottleneck and the people involved.'],
  ['3', '"What\'s the biggest friction point in your intake right now?"', 'Lets them name the pain themselves.'],
  ['4', '"Have you ever passed on a case you later wished you hadn\'t — because you didn\'t have time to properly review it?"', 'This opens the real conversation. Most will say yes.'],
];

for (const [num, q, why] of questions) {
  doc.rect(50, y, 24, 28).fill(INDIGO);
  doc.font('Helvetica-Bold').fontSize(13).fillColor(WHITE)
     .text(num, 50, y + 6, { width: 24, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
     .text(q, 82, y + 2, { width: W - 140 });
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(GRAY)
     .text(why, 82, y + 16, { width: W - 140 });
  y += 36;
}

// Objection handling
y += 4;
y = sectionHeader('OBJECTION HANDLING', y);

const objections = [
  ['"We already have a process"', '"That\'s great — most firms do. The question is how much attorney time it takes. Can I show you what ours looks like?"'],
  ['"Does it integrate with Clio?"', '"Not yet — but the PDF export drops cleanly into any system. Integration is on the roadmap."'],
  ['"What if the AI gets it wrong?"', '"It organizes — it never decides. Your attorney reviews everything. It\'s a better-organized pile, not a recommendation."'],
  ['"We\'re not ready to pay yet"', '"That\'s exactly why we have a 60-day free pilot. No credit card. You use it on real intakes and decide after."'],
];

for (const [obj, ans] of objections) {
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(RED).text(obj, 50, y, { width: 200 });
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK).text(ans, 260, y, { width: W - 310 });
  doc.moveTo(50, y + 18).lineTo(W - 50, y + 18).strokeColor('#F3F4F6').lineWidth(0.5).stroke();
  y += 24;
}

doc.rect(0, H - 36, W, 36).fill(NAVY);
doc.font('Helvetica').fontSize(8).fillColor('#6366F1')
   .text('one3Seven Sales Bible  ·  Page 2 of 3  ·  Internal Use Only', 50, H - 22, { width: W - 100, align: 'center' });

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 3 — TAD'S PLAYBOOK & THE SALES ROADMAP
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
pageHeader('Sales Bible — Tad\'s Playbook & Revenue Roadmap', 'Internal Use Only');
y = 90;

// Tad's role
y = sectionHeader('TAD\'S ROLE RIGHT NOW  —  SDR (SALES DEVELOPMENT REP)', y);

doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text(
     'Victoria closes. Tad opens. Your job is to find the right firms, reach the right person, ' +
     'and book a 20-minute demo call. That\'s it. Don\'t pitch the product — pitch the conversation.',
     50, y, { width: W - 100 }
   );
y += 36;

const tadTasks = [
  ['Find target firms', 'Employment plaintiff firms, 1–15 attorneys, CA/NY/IL/TX. Use Google, Avvo, state bar directories, LinkedIn.'],
  ['Find the right contact', 'Managing Partner or Operations Director — not associates. LinkedIn is your best tool.'],
  ['Warm outreach first', 'Bar association contacts, legal ops groups, referrals from anyone you know. Warm beats cold every time.'],
  ['The ask is small', '"I built something that organizes worker intakes before the first call. Can I show you 20 minutes?" That\'s the whole pitch.'],
  ['Follow up', 'Law firms move slowly. One follow-up is not aggressive — it is expected. Three touchpoints before moving on.'],
  ['Book the demo', 'Hand off to Victoria. Your job ends at the meeting being on the calendar.'],
];

for (const [bold, rest] of tadTasks) {
  bullet(56, y, INDIGO);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
     .text(bold + '  ', 68, y, { continued: true, width: W - 118 });
  doc.font('Helvetica').fillColor(GRAY).text(rest);
  y += 22;
}

// Outreach templates
y += 6;
y = sectionHeader('OUTREACH TEMPLATES', y);

// LinkedIn
doc.rect(50, y, W - 100, 14).fill(INDIGO);
doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text('LinkedIn — First Message', 58, y + 3);
y += 16;
doc.rect(50, y, W - 100, 52).fill('#F9FAFB');
doc.font('Helvetica').fontSize(9).fillColor(DARK)
   .text(
     'Hi [Name] — I work with a legal tech startup called one3Seven. We built a tool that organizes worker ' +
     'intake documents before the first attorney call — timeline, records, flagged gaps — all done before anyone picks up the phone.\n\n' +
     'I thought it might be worth 20 minutes given what employment firms typically deal with on intake. Would you be open to a quick look?',
     58, y + 6, { width: W - 116 }
   );
y += 60;

// Email
doc.rect(50, y, W - 100, 14).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text('Email — Subject: Intake organization for employment firms', 58, y + 3);
y += 16;
doc.rect(50, y, W - 100, 68).fill('#F9FAFB');
doc.font('Helvetica').fontSize(9).fillColor(DARK)
   .text(
     '[Name],\n\n' +
     'I built a tool for employment plaintiff firms that organizes worker intake documents before the first attorney call.\n\n' +
     'Worker uploads documents. AI builds the timeline, categorizes records, flags gaps. Attorney opens one clean packet.\n\n' +
     'We\'re in beta with a 60-day free pilot — no credit card, full access. If intake organization is a real friction point for your firm, ' +
     'I\'d love to show you a 20-minute demo.\n\nWorth a look?',
     58, y + 6, { width: W - 116 }
   );
y += 76;

// Sales roadmap
y += 6;
y = sectionHeader('THE SALES ROADMAP — WHERE THIS IS GOING', y);

const roadmap = [
  { phase: 'Now', label: 'Founder Sales', detail: 'Victoria closes first 5 firms. Tad books meetings. 60-day free pilot removes all friction.', color: INDIGO },
  { phase: 'Month 3-4', label: 'Paid Beta', detail: 'First paying firms. Collect testimonials and case studies. Refine the pitch from real objections.', color: GREEN },
  { phase: 'Month 6', label: 'First AE Hire', detail: 'Legal tech sales experience required. Victoria has a proven close script to hand over.', color: GOLD },
  { phase: 'Month 9-12', label: 'Repeatable Process', detail: 'SDR + AE + Customer Success. Clio conference presence. Bar association partnerships.', color: NAVY },
];

for (const row of roadmap) {
  doc.rect(50, y, 72, 32).fill(row.color);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
     .text(row.phase, 50, y + 4, { width: 72, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE)
     .text(row.label, 50, y + 16, { width: 72, align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor(DARK)
     .text(row.detail, 132, y + 8, { width: W - 190 });
  y += 36;
}

// Revenue targets
y += 6;
y = sectionHeader('REVENUE TARGETS', y);

const targets = [
  ['5 firms', '$2,660/mo MRR', '$31,920 ARR', 'Early traction — first case studies'],
  ['10 firms', '$5,320/mo MRR', '$63,840 ARR', 'Proof of demand — first AE conversation'],
  ['25 firms', '$13,300/mo MRR', '$159,600 ARR', 'Serious business — acquisition interest'],
  ['50 firms', '$26,600/mo MRR', '$319,200 ARR', 'Series A conversation'],
];

const tx = [50, 140, 250, 355];
doc.rect(50, y, W - 100, 16).fill(NAVY);
['Firms', 'MRR', 'ARR', 'What It Means'].forEach((h, i) => {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text(h, tx[i] + 4, y + 3);
});
y += 16;

targets.forEach(([firms, mrr, arr, meaning], i) => {
  doc.rect(50, y, W - 100, 18).fill(i % 2 === 0 ? '#F9FAFB' : WHITE);
  const isGold = i >= 2;
  doc.font(isGold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
     .fillColor(isGold ? GOLD : DARK).text(firms, tx[0] + 4, y + 4);
  doc.font('Helvetica').fontSize(9).fillColor(GREEN).text(mrr, tx[1] + 4, y + 4);
  doc.font('Helvetica').fontSize(9).fillColor(DARK).text(arr, tx[2] + 4, y + 4);
  doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRAY).text(meaning, tx[3] + 4, y + 4);
  y += 18;
});

doc.rect(0, H - 36, W, 36).fill(NAVY);
doc.font('Helvetica').fontSize(8).fillColor('#6366F1')
   .text('one3Seven Sales Bible  ·  Page 3 of 3  ·  one3seven-beta.vercel.app  ·  hello@one3seven.com', 50, H - 22, { width: W - 100, align: 'center' });

doc.end();
console.log('Sales Bible written to', OUT);
