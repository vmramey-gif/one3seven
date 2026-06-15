const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'one3seven-how-you-get-paid.pdf');
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

const fmt = (n) => '$' + Number(n).toLocaleString('en-US');

function pageTop(title, sub, pageNum) {
  doc.rect(0, 0, W, 82).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(22).fillColor(WHITE).text('one3Seven', 50, 18);
  doc.font('Helvetica').fontSize(10).fillColor('#A5B4FC').text(title, 50, 48);
  if (sub) doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#818CF8').text(sub, 50, 64, { width: W - 200 });
  doc.font('Helvetica').fontSize(8).fillColor('#4F46E5')
     .text('Page ' + pageNum + ' of 3  ·  Confidential', W - 170, 54, { width: 120, align: 'right' });
}

function sectionHead(label, y) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INDIGO)
     .text(label, 50, y, { characterSpacing: 1.1 });
  doc.moveTo(50, y + 13).lineTo(W - 50, y + 13).strokeColor(LIGHT).lineWidth(1).stroke();
  return y + 22;
}

function pageFooter(n) {
  doc.rect(0, H - 32, W, 32).fill(NAVY);
  doc.font('Helvetica').fontSize(8).fillColor('#6366F1')
     .text('one3Seven  ·  Founding Sales Partner Program  ·  Page ' + n + ' of 3  ·  one3seven-beta.vercel.app',
       50, H - 20, { width: W - 100, align: 'center' });
}

// ════════════════════════════════════════════════════════════════════════════
// PAGE 1 — THE PROGRAM & HOW PAY WORKS
// ════════════════════════════════════════════════════════════════════════════
pageTop('Founding Sales Partner Program', 'Ground floor. Real earnings. Clear path forward.', 1);
let y = 96;

// Hero box
doc.rect(50, y, W - 100, 46).fill(INDIGO);
doc.font('Helvetica-Bold').fontSize(13).fillColor(WHITE)
   .text('You are not a sales rep. You are a Founding Sales Partner.', 68, y + 8, { width: W - 136 });
doc.font('Helvetica').fontSize(9.5).fillColor('#C7D2FE')
   .text('The people who help one3Seven reach its first 25 firms will earn the most — and have first right to the Head of Sales role.', 68, y + 28, { width: W - 136 });
y += 58;

// What you do
y = sectionHead('YOUR JOB — THREE SENTENCES', y);
doc.rect(50, y, W - 100, 44).fill('#F9FAFB');
doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text(
     'Find employment law firms that match our profile. Reach the managing partner or operations director. ' +
     'Get them to say yes to a 20-minute demo call.\n\n' +
     'Victoria (the founder) runs the demo and closes the deal. You earn when they sign.',
     62, y + 8, { width: W - 124 }
   );
y += 56;

// Pay structure — simplified
y = sectionHead('HOW YOU GET PAID — SIMPLE VERSION', y);

const payBlocks = [
  {
    label: 'Upfront Close Commission',
    rate: '20% of first paid month',
    math: 'Solo ($199)  →  you earn  $39.80\nPractice ($499)  →  you earn  $99.80\nFirm ($899)  →  you earn  $179.80',
    note: 'Paid once, the month the firm\'s first payment clears.',
    color: INDIGO,
    big: '20%',
  },
  {
    label: 'Trail Income',
    rate: '5% every month for 24 months',
    math: 'Practice firm ($499/mo)  →  $24.95/month\n24 months of trail  =  $598.80 from one firm\nWithout closing anything new.',
    note: '24-month window keeps it predictable for both sides.',
    color: GREEN,
    big: '5%',
  },
];

payBlocks.forEach((block, i) => {
  const bx = 50 + i * ((W - 110) / 2 + 5);
  const bw = (W - 110) / 2;
  const bh = 118;
  doc.rect(bx, y, bw, bh).fill('#F9FAFB').stroke('#E5E7EB');
  doc.rect(bx, y, bw, 22).fill(block.color);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE).text(block.label, bx + 10, y + 6, { width: bw - 20 });
  doc.font('Helvetica-Bold').fontSize(26).fillColor(block.color).text(block.big, bx + 10, y + 28);
  doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(block.rate, bx + 10, y + 58, { width: bw - 20 });
  doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(DARK).text(block.math, bx + 10, y + 72, { width: bw - 20 });
  y = i === 1 ? y + bh + 10 : y;
});

// Milestone bonuses
y = sectionHead('MILESTONE BONUSES — CASH ON TOP OF EVERYTHING ELSE', y);

const milestones = [
  { firms: '5 firms closed',  bonus: '$500',   note: 'First milestone — paid that month' },
  { firms: '10 firms closed', bonus: '$1,000', note: 'Growing — paid that month' },
  { firms: '25 firms closed', bonus: '$2,500', note: 'Serious traction — paid that month' },
];

const mx = [50, 200, 320];
doc.rect(50, y, W - 100, 18).fill(NAVY);
['Milestone', 'Cash Bonus', 'When It Pays'].forEach((h, i) => {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text(h, mx[i] + 4, y + 4);
});
y += 18;

milestones.forEach((row, i) => {
  doc.rect(50, y, W - 100, 22).fill(i % 2 === 0 ? '#FAFAFA' : WHITE);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK).text(row.firms, mx[0] + 4, y + 5);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(GOLD).text(row.bonus, mx[1] + 4, y + 5);
  doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(row.note, mx[2] + 4, y + 5);
  y += 22;
});

y += 10;
doc.rect(50, y, W - 100, 28).fill(LIGHT);
doc.rect(50, y, 5, 28).fill(GOLD);
doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY)
   .text('Hit all three milestones  =  $4,000 in bonuses on top of commissions and trail income.', 68, y + 9, { width: W - 140 });

pageFooter(1);

// ════════════════════════════════════════════════════════════════════════════
// PAGE 2 — PIPELINE MODEL & REALISTIC EARNINGS
// ════════════════════════════════════════════════════════════════════════════
doc.addPage();
pageTop('What You Can Realistically Earn', 'Based on a real pipeline model — not best-case numbers.', 2);
y = 96;

// Pipeline model
y = sectionHead('THE QUESTION EVERY GOOD SALESPERSON ASKS: "HOW MANY CAN I CLOSE?"', y);

doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
   .text(
     'Here is our honest pipeline model based on legal tech sales cycles and employment firm outreach. ' +
     'This is what a focused sales partner working part-time (10–15 hours/week) should expect.',
     50, y, { width: W - 100 }
   );
y += 32;

// Funnel visual
const funnel = [
  { stage: 'Firms contacted',       n: '100', color: NAVY,   pct: '' },
  { stage: 'Responded / curious',   n: '20',  color: INDIGO, pct: '20% response rate' },
  { stage: 'Demo calls booked',     n: '8',   color: '#4F46E5', pct: '40% of conversations' },
  { stage: 'Trials started',        n: '3',   color: GREEN,  pct: '35% of demos' },
  { stage: 'Paid customers',        n: '1–2', color: GOLD,   pct: '50–70% of trials convert' },
];

const funnelW = W - 100;
funnel.forEach((row, i) => {
  const rowW = funnelW - i * 36;
  const rx = 50 + i * 18;
  doc.rect(rx, y, rowW, 24).fill(row.color);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE)
     .text(row.n, rx + 10, y + 6, { continued: true });
  doc.font('Helvetica').fontSize(9).fillColor('rgba(255,255,255,0.85)')
     .text('  ' + row.stage, { continued: true, width: rowW - 120 });
  if (row.pct) {
    doc.font('Helvetica-Oblique').fontSize(8).fillColor('rgba(255,255,255,0.65)')
       .text('  (' + row.pct + ')');
  } else {
    doc.text('');
  }
  y += 26;
});

y += 8;
doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(GRAY)
   .text('Model assumes cold outreach to employment plaintiff firms. Warm intros through bar associations or referrals convert significantly faster.', 50, y, { width: W - 100 });
y += 22;

// Monthly pace
y = sectionHead('REALISTIC MONTHLY PACE', y);

const paceRows = [
  ['Part-time (10 hrs/week)', '40–60 firms contacted/mo', '0–1 paid customers/mo', 'Best for: side income, testing the opportunity'],
  ['Active (20 hrs/week)',    '80–100 firms contacted/mo', '1–2 paid customers/mo', 'Best for: building real trail income over 6 months'],
  ['Full-time',               '150+ firms contacted/mo',  '2–4 paid customers/mo', 'Best for: earning toward Head of Sales role'],
];

doc.rect(50, y, W - 100, 18).fill(NAVY);
['Commitment', 'Outreach Volume', 'Expected Closes', 'Best For'].forEach((h, i) => {
  const px = [50, 160, 280, 390];
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text(h, px[i] + 4, y + 4);
});
y += 18;

paceRows.forEach((row, i) => {
  const px = [50, 160, 280, 390];
  doc.rect(50, y, W - 100, 26).fill(i % 2 === 0 ? '#FAFAFA' : WHITE);
  const colors = [INDIGO, DARK, GREEN, GRAY];
  row.forEach((cell, j) => {
    doc.font(j === 0 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
       .fillColor(colors[j]).text(cell, px[j] + 4, y + 8, { width: j === 3 ? W - px[3] - 60 : px[j + 1] - px[j] - 8 });
  });
  y += 26;
});

// Earnings scenarios
y += 14;
y = sectionHead('EARNINGS SCENARIOS — 12 MONTHS', y);

const scenarios = [
  { label: 'Conservative',    firms: 4,  upfront: 400,  trail24mo: 480,  bonuses: 500,  total: 1380  },
  { label: 'Realistic',       firms: 8,  upfront: 800,  trail24mo: 960,  bonuses: 1500, total: 3260  },
  { label: 'Strong',          firms: 15, upfront: 1497, trail24mo: 1797, bonuses: 2000, total: 5294  },
  { label: 'Milestone run',   firms: 25, upfront: 2495, trail24mo: 2994, bonuses: 4000, total: 9489, gold: true },
];

const sc = [50, 148, 230, 322, 408, 490];
doc.rect(50, y, W - 100, 18).fill(NAVY);
['Scenario', 'Firms', 'Upfront', 'Trail (24mo)', 'Bonuses', 'Year 1 Total'].forEach((h, i) => {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text(h, sc[i] + 4, y + 4);
});
y += 18;

scenarios.forEach((row, i) => {
  doc.rect(50, y, W - 100, 22).fill(i % 2 === 0 ? '#FAFAFA' : WHITE);
  doc.font(row.gold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5)
     .fillColor(row.gold ? GOLD : DARK).text(row.label, sc[0] + 4, y + 5);
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK).text(row.firms + ' firms', sc[1] + 4, y + 5);
  doc.font('Helvetica').fontSize(9.5).fillColor(INDIGO).text(fmt(row.upfront), sc[2] + 4, y + 5);
  doc.font('Helvetica').fontSize(9.5).fillColor(GREEN).text(fmt(row.trail24mo), sc[3] + 4, y + 5);
  doc.font('Helvetica').fontSize(9.5).fillColor(GOLD).text(fmt(row.bonuses), sc[4] + 4, y + 5);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(row.gold ? GOLD : NAVY).text(fmt(row.total), sc[5] + 4, y + 5);
  y += 22;
});

y += 8;
doc.font('Helvetica-Oblique').fontSize(8).fillColor(GRAY)
   .text('Upfront = 20% of first paid month per firm (blended $499 avg). Trail = 5%/mo × 24 months. Bonuses per milestone structure on Page 1.', 50, y, { width: W - 100 });

pageFooter(2);

// ════════════════════════════════════════════════════════════════════════════
// PAGE 3 — THE PROMOTION PATH & HEAD OF SALES COMP
// ════════════════════════════════════════════════════════════════════════════
doc.addPage();
pageTop('The Path Forward — From Partner to Revenue Leader', 'This is not a dead-end gig. It is a career track.', 3);
y = 96;

// Promotion path visual
y = sectionHead('THE THREE STAGES', y);

const stages = [
  {
    stage: 'Stage 1',
    title: 'Founding Sales Partner',
    timing: 'Now — Month 6',
    pay: '20% upfront  +  5% trail (24mo)  +  milestone bonuses',
    what: 'Outreach, warm intros, booked demos. Ground floor earnings. Build trail income before anyone else.',
    color: INDIGO,
  },
  {
    stage: 'Stage 2',
    title: 'Head of Sales',
    timing: 'Month 6 – Month 18',
    pay: '$4,000–$6,000 base  +  10% personal closes  +  2% team override  +  equity',
    what: 'Build and own the sales team. Hire reps. Own the revenue number. Earn on everything the team closes.',
    color: GREEN,
  },
  {
    stage: 'Stage 3',
    title: 'Revenue Leader (VP Sales)',
    timing: 'Month 18+',
    pay: 'Market rate base  +  executive commission  +  meaningful equity stake',
    what: 'Full revenue ownership. Strategic partnerships. Conference presence. Series A positioning.',
    color: GOLD,
  },
];

stages.forEach((s) => {
  doc.rect(50, y, W - 100, 72).fill('#F9FAFB').stroke('#E5E7EB');
  doc.rect(50, y, W - 100, 20).fill(s.color);

  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text(s.stage + '  —', 62, y + 5, { continued: true });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE).text('  ' + s.title, { continued: true });
  doc.font('Helvetica').fontSize(8.5).fillColor('rgba(255,255,255,0.7)').text('   ' + s.timing);

  doc.font('Helvetica-Bold').fontSize(9).fillColor(s.color).text('Pay:  ', 62, y + 26, { continued: true });
  doc.font('Helvetica').fontSize(9).fillColor(DARK).text(s.pay, { width: W - 130 });

  doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(s.what, 62, y + 44, { width: W - 124 });

  y += 80;
});

// Arrow connectors
doc.font('Helvetica-Bold').fontSize(14).fillColor(INDIGO)
   .text('↓', W / 2 - 6, y - 165)
   .text('↓', W / 2 - 6, y - 82);

// Head of Sales full pay breakdown
y += 4;
y = sectionHead('HEAD OF SALES — FULL COMPENSATION BREAKDOWN', y);

const hsRows = [
  ['Base salary', '$4,000 – $6,000/month', 'Guaranteed monthly — paid whether or not deals close'],
  ['Personal close rate', '10% of first paid month', 'When you close a deal yourself — higher than partner rate'],
  ['Team override', '2% of all team revenue', 'You earn a cut of every deal your reps close too'],
  ['Equity', '0.5% – 2% of company', 'Real ownership — valuable at acquisition or funding'],
  ['Team milestone bonus', '$1,000 at 25 / 50 / 100 firms', 'Larger cash bonuses at team-level milestones'],
];

const hc = [50, 210, 340];
doc.rect(50, y, W - 100, 18).fill(NAVY);
['Pay Type', 'Amount', 'Plain English'].forEach((h, i) => {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text(h, hc[i] + 4, y + 4);
});
y += 18;

hsRows.forEach(([type, amount, desc], i) => {
  doc.rect(50, y, W - 100, 22).fill(i % 2 === 0 ? '#FAFAFA' : WHITE);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GOLD).text(type, hc[0] + 4, y + 6, { width: 155 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN).text(amount, hc[1] + 4, y + 6, { width: 124 });
  doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(desc, hc[2] + 4, y + 6, { width: W - hc[2] - 60 });
  y += 22;
});

// What gets you promoted
y += 12;
y = sectionHead('WHAT GETS YOU PROMOTED TO HEAD OF SALES', y);

const promoItems = [
  'You personally close or directly refer 10+ paying firms',
  'Those firms stay active — you show retention, not just acquisition',
  'You demonstrate you can teach someone else what you did to close them',
  'You show up as a partner, not just a commission earner',
];

for (const item of promoItems) {
  doc.circle(58, y + 5, 3).fill(GREEN);
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK).text(item, 70, y, { width: W - 120 });
  y += 18;
}

// Closing
y += 10;
doc.rect(50, y, W - 100, 72).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(12).fillColor(WHITE)
   .text('This is a ground-floor opportunity. Ground floor means early.', 68, y + 10, { width: W - 136 });
doc.font('Helvetica').fontSize(9.5).fillColor('#A5B4FC')
   .text(
     'The legal tech market is moving fast. Employment firms are actively looking for tools that reduce intake chaos. ' +
     'The Founding Sales Partner who builds the first 25 firm relationships will have trail income, milestone bonuses, ' +
     'and first right to a salaried leadership role with equity in a company that is already built and working.',
     68, y + 30, { width: W - 136 }
   );

pageFooter(3);

doc.end();
doc.on('end', () => console.log('Written to', OUT));
