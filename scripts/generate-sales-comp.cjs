const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'one3seven-sales-opportunity.pdf');
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

function sectionHeader(label, y) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(INDIGO)
     .text(label, 50, y, { characterSpacing: 1.2 });
  const ly = y + 14;
  doc.moveTo(50, ly).lineTo(W - 50, ly).strokeColor(LIGHT).lineWidth(1).stroke();
  return ly + 10;
}

// ── HEADER ───────────────────────────────────────────────────────────────────
doc.rect(0, 0, W, 96).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(26).fillColor(WHITE).text('one3Seven', 50, 22);
doc.font('Helvetica').fontSize(11).fillColor('#A5B4FC')
   .text('Sales Partner Opportunity', 50, 54);
doc.font('Helvetica').fontSize(9).fillColor('#6366F1')
   .text('What you can earn — Month 1 through Month 12', 50, 72);

// tag
doc.font('Helvetica').fontSize(9).fillColor('#818CF8')
   .text('Confidential · June 2026', W - 170, 56, { width: 120, align: 'right' });

// ── OPENING STATEMENT ─────────────────────────────────────────────────────────
let y = 112;
doc.rect(50, y, W - 100, 52).fill(LIGHT);
doc.rect(50, y, 5, 52).fill(INDIGO);
doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY)
   .text('This is a ground-floor opportunity.', 68, y + 8, { width: W - 140 });
doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text(
     'one3Seven is a working legal tech product in active beta. We are building the sales team now — ' +
     'before the growth curve hits. The people who help us reach the first 25 firms will earn the most.',
     68, y + 26, { width: W - 140 }
   );
y += 66;

// ── YOUR ROLE ────────────────────────────────────────────────────────────────
y = sectionHeader('YOUR ROLE', y);

doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text(
     'You connect us to employment law firms. That means reaching out to managing partners, practice managers, ' +
     'and intake directors at plaintiff-side employment firms. Your goal is simple: book a 20-minute demo call. ' +
     'We close. You earn.',
     50, y, { width: W - 100 }
   );
y += 44;

// ── COMPENSATION STRUCTURE ───────────────────────────────────────────────────
y = sectionHeader('HOW YOU GET PAID', y);

// Three boxes
const boxW = (W - 120) / 3;
const boxH = 110;
const boxes = [
  {
    label: 'Commission Per Close',
    amount: '15%',
    sub: 'of first 3 months revenue',
    detail: 'You close or refer a firm on the Practice plan ($499/mo). You earn $224.55 on that firm for the first 3 months.',
    color: INDIGO,
  },
  {
    label: 'Residual Trail',
    amount: '5%',
    sub: 'monthly as long as firm pays',
    detail: 'Every month the firm stays active, you earn 5% of their plan. A $499/mo firm pays you $24.95 every single month.',
    color: GREEN,
  },
  {
    label: 'Milestone Bonus',
    amount: '$500',
    sub: 'per milestone hit',
    detail: 'Bonuses paid at 5 firms closed, 10 firms closed, and 25 firms closed. Stack them — hit all three, earn $1,500 extra.',
    color: GOLD,
  },
];

boxes.forEach((box, i) => {
  const x = 50 + i * (boxW + 10);
  doc.rect(x, y, boxW, boxH).fill(box.color);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
     .text(box.label, x + 10, y + 10, { width: boxW - 20 });
  doc.font('Helvetica-Bold').fontSize(28).fillColor(WHITE)
     .text(box.amount, x + 10, y + 26, { width: boxW - 20 });
  doc.font('Helvetica').fontSize(8.5).fillColor('rgba(255,255,255,0.8)')
     .text(box.sub, x + 10, y + 58, { width: boxW - 20 });
  doc.font('Helvetica').fontSize(8).fillColor('rgba(255,255,255,0.75)')
     .text(box.detail, x + 10, y + 72, { width: boxW - 20 });
});

y += boxH + 18;

// ── EARNINGS SCENARIOS ───────────────────────────────────────────────────────
y = sectionHeader('WHAT YOU ACTUALLY TAKE HOME — REAL SCENARIOS', y);

// table header
const cx = [50, 145, 255, 365, 472];
doc.rect(50, y, W - 100, 18).fill(NAVY);
['Scenario', 'Firms Closed', 'Upfront Earned', 'Monthly Trail', 'Month 12 Total'].forEach((h, i) => {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text(h, cx[i] + 4, y + 4);
});
y += 18;

const scenarios = [
  {
    label: 'Conservative',
    firms: 3,
    upfront: 674,    // 3 × $499 × 3mo × 15% = $674.55
    trail: 75,       // 3 × $499 × 5% = $74.85/mo
    total: 1573,     // $674 + ($75 × 12) = $1,574
    color: null,
  },
  {
    label: 'Realistic',
    firms: 8,
    upfront: 1796,   // 8 × $499 × 3 × 15%
    trail: 200,      // 8 × $499 × 5%
    total: 4196,     // $1,796 + ($200 × 12)
    color: LIGHT,
  },
  {
    label: 'Strong',
    firms: 15,
    upfront: 3368,   // 15 × $499 × 3 × 15%
    trail: 374,      // 15 × $499 × 5%
    total: 7856,     // $3,368 + ($374 × 12) + $500 bonus (10-firm)
    color: null,
  },
  {
    label: 'Milestone run',
    firms: 25,
    upfront: 5614,   // 25 × $499 × 3 × 15%
    trail: 624,      // 25 × $499 × 5%
    total: 15,       // placeholder, calculated below
    color: LIGHT,
    gold: true,
  },
];

// milestone run total: $5,614 upfront + ($624 × 12 trail) + $1,500 bonuses = $14,602
scenarios[3].total = 14602;

const fmt = (n) => '$' + n.toLocaleString('en-US');

scenarios.forEach((row, i) => {
  const bg = row.color ?? (i % 2 === 0 ? '#FAFAFA' : WHITE);
  doc.rect(50, y, W - 100, 22).fill(bg);
  doc.font(row.gold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5)
     .fillColor(row.gold ? GOLD : DARK)
     .text(row.label, cx[0] + 4, y + 5);
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
     .text(row.firms + ' firms', cx[1] + 4, y + 5);
  doc.font('Helvetica').fontSize(9.5).fillColor(INDIGO)
     .text(fmt(row.upfront), cx[2] + 4, y + 5);
  doc.font('Helvetica').fontSize(9.5).fillColor(GREEN)
     .text(fmt(row.trail) + '/mo', cx[3] + 4, y + 5);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(row.gold ? GOLD : DARK)
     .text(fmt(row.total), cx[4] + 4, y + 5);
  y += 22;
});

y += 6;
doc.font('Helvetica-Oblique').fontSize(8).fillColor(GRAY)
   .text(
     '* Based on blended $499/mo Practice plan average. Upfront = 15% of first 3 months. Trail = 5%/mo ongoing. ' +
     'Milestone bonuses ($500 at 5, 10, and 25 firms) included in Milestone run total.',
     50, y, { width: W - 100 }
   );

// ── MONTH BY MONTH ────────────────────────────────────────────────────────────
y += 18;
y = sectionHeader('MONTH-BY-MONTH EARNINGS — REALISTIC SCENARIO (8 FIRMS)', y);

const months = [
  { mo: 'Month 1', firms: 1, newEarned: 224, trail: 0,   cumulative: 224  },
  { mo: 'Month 2', firms: 2, newEarned: 224, trail: 25,  cumulative: 473  },
  { mo: 'Month 3', firms: 3, newEarned: 224, trail: 50,  cumulative: 747  },
  { mo: 'Month 4', firms: 4, newEarned: 224, trail: 75,  cumulative: 1046 },
  { mo: 'Month 5', firms: 5, newEarned: 724, trail: 100, cumulative: 1870 }, // +$500 bonus
  { mo: 'Month 6', firms: 6, newEarned: 224, trail: 125, cumulative: 2219 },
  { mo: 'Month 7', firms: 7, newEarned: 224, trail: 150, cumulative: 2593 },
  { mo: 'Month 8', firms: 8, newEarned: 224, trail: 175, cumulative: 2992 },
  { mo: 'Month 9',  firms: 8, newEarned: 0,   trail: 200, cumulative: 3192 },
  { mo: 'Month 10', firms: 8, newEarned: 0,   trail: 200, cumulative: 3392 },
  { mo: 'Month 11', firms: 8, newEarned: 0,   trail: 200, cumulative: 3592 },
  { mo: 'Month 12', firms: 8, newEarned: 0,   trail: 200, cumulative: 3792 },
];

const mh = 16;
const mw = (W - 100) / 5;
const mLabels = ['Month', 'Total Firms', 'New Commission', 'Trail Income', 'Cumulative'];

doc.rect(50, y, W - 100, mh).fill(NAVY);
mLabels.forEach((h, i) => {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
     .text(h, 50 + i * mw + 4, y + 4);
});
y += mh;

months.forEach((row, i) => {
  const isBonus = row.mo === 'Month 5';
  doc.rect(50, y, W - 100, mh).fill(isBonus ? '#FEF3C7' : i % 2 === 0 ? '#F9FAFB' : WHITE);
  doc.font(isBonus ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5)
     .fillColor(isBonus ? GOLD : DARK).text(row.mo, 50 + 4, y + 4);
  doc.font('Helvetica').fontSize(8.5).fillColor(DARK)
     .text(row.firms + ' firms', 50 + mw + 4, y + 4);
  doc.font('Helvetica').fontSize(8.5).fillColor(INDIGO)
     .text(row.newEarned > 0 ? fmt(row.newEarned) + (isBonus ? ' +bonus' : '') : '—', 50 + mw * 2 + 4, y + 4);
  doc.font('Helvetica').fontSize(8.5).fillColor(GREEN)
     .text(row.trail > 0 ? fmt(row.trail) : '—', 50 + mw * 3 + 4, y + 4);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(DARK)
     .text(fmt(row.cumulative), 50 + mw * 4 + 4, y + 4);
  y += mh;
});

// ── CLOSING BOX ───────────────────────────────────────────────────────────────
y += 12;
const closeH = 70;
doc.rect(50, y, W - 100, closeH).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(12).fillColor(WHITE)
   .text('The earlier you start, the more you earn.', 68, y + 10, { width: W - 136 });
doc.font('Helvetica').fontSize(10).fillColor('#A5B4FC')
   .text(
     'Every firm you bring in pays trail income for as long as they stay on the platform. ' +
     'The sales partner who helps us reach the first 25 firms will have built a meaningful passive income stream — ' +
     'not just a one-time check.',
     68, y + 28, { width: W - 136 }
   );

// ── FOOTER ────────────────────────────────────────────────────────────────────
doc.rect(0, H - 36, W, 36).fill(INDIGO);
doc.font('Helvetica').fontSize(9).fillColor(WHITE)
   .text(
     'one3seven-beta.vercel.app  ·  hello@one3seven.com  ·  Earnings are projections based on plan pricing and commission structure above.',
     50, H - 22, { width: W - 100, align: 'center' }
   );

doc.end();
console.log('Sales opportunity PDF written to', OUT);
