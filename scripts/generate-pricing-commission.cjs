const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'one3seven-pricing-commission.pdf');
const doc = new PDFDocument({ size: 'LETTER', margin: 0, autoFirstPage: true });
doc.pipe(fs.createWriteStream(OUT));

const W = 612;
const H = 792;
const ML = 50;
const TW = W - ML * 2;

const NAVY   = '#1E1B4B';
const INDIGO = '#6366F1';
const PURPLE = '#6D4AFF';
const LAVBG  = '#F6F2FF';
const LIGHT  = '#EEF2FF';
const BORDER = '#E7E1FF';
const WHITE  = '#FFFFFF';
const GRAY   = '#6B7280';
const DARK   = '#111827';
const GREEN  = '#059669';
const AMBER  = '#D97706';
const LILAC  = '#A5B4FC';
const MUTED  = '#6B7280';

function pageHeader(sub, pageNum, total) {
  doc.rect(0, 0, W, 68).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(17).fillColor(WHITE).text('one3Seven', ML, 16);
  doc.font('Helvetica').fontSize(9).fillColor(LILAC).text(sub, ML, 40);
  doc.rect(W - 88, 18, 38, 18).fill(PURPLE);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
     .text(`${pageNum} of ${total}`, W - 88, 23, { width: 38, align: 'center' });
}

function pageFooter() {
  doc.rect(0, H - 26, W, 26).fill(INDIGO);
  doc.font('Helvetica').fontSize(8).fillColor(WHITE)
     .text('one3Seven  ·  one3seven-beta.vercel.app  ·  Confidential — Internal Use', ML, H - 17, { width: TW, align: 'center' });
}

function sectionLabel(text, y) {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INDIGO)
     .text(text, ML, y, { characterSpacing: 1.1 });
  doc.moveTo(ML, y + 12).lineTo(W - ML, y + 12).strokeColor(LIGHT).lineWidth(0.75).stroke();
  return y + 20;
}

function body(text, y, opts) {
  opts = opts || {};
  doc.font('Helvetica').fontSize(10).fillColor('#374151')
     .text(text, ML, y, Object.assign({ width: TW, lineGap: 2.5 }, opts));
  return y + doc.heightOfString(text, Object.assign({ width: TW, lineGap: 2.5 }, opts)) + 9;
}

function callout(text, y, color) {
  color = color || PURPLE;
  const innerW = TW - 32;
  const h = doc.heightOfString(text, { width: innerW, lineGap: 2.5 }) + 24;
  doc.rect(ML, y, TW, h).fill(LIGHT);
  doc.rect(ML, y, 4, h).fill(color);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(NAVY)
     .text(text, ML + 16, y + 12, { width: innerW, lineGap: 2.5 });
  return y + h + 12;
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 1 — BETA PRICING + PILOT OFFER
// ═══════════════════════════════════════════════════════════════════════════
pageHeader('Pricing, Pilot Offer & Commission Structure', 1, 2);
let y = 84;

// ── HERO STATEMENT ─────────────────────────────────────────────────────────
doc.rect(ML, y, TW, 52).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(14).fillColor(WHITE)
   .text('Three plans. One pilot offer. One commission structure.', ML + 16, y + 10, { width: TW - 32 });
doc.font('Helvetica').fontSize(10).fillColor(LILAC)
   .text('Everything below is live in the product today.', ML + 16, y + 33, { width: TW - 32 });
y += 64;

// ── BETA PRICING ───────────────────────────────────────────────────────────
y = sectionLabel('CURRENT BETA PRICING — LIVE IN APP', y);

const plans = [
  {
    name: 'Solo',
    price: '$199',
    period: '/mo',
    intakes: '15 intakes/mo',
    seats: '1 seat',
    note: 'Solo practitioners',
    color: INDIGO,
    highlight: false,
  },
  {
    name: 'Practice',
    price: '$499',
    period: '/mo',
    intakes: '50 intakes/mo',
    seats: '3 seats',
    note: 'Anchor plan — most firms',
    color: PURPLE,
    highlight: true,
  },
  {
    name: 'Firm',
    price: '$899',
    period: '/mo',
    intakes: 'Unlimited intakes',
    seats: '10 seats',
    note: 'Mid-size firms',
    color: INDIGO,
    highlight: false,
  },
];

const planW = TW / 3 - 6;
for (let i = 0; i < plans.length; i++) {
  const p = plans[i];
  const px = ML + i * (planW + 9);
  const cardH = p.highlight ? 148 : 138;

  if (p.highlight) {
    doc.rect(px - 2, y - 2, planW + 4, cardH + 4).fill(PURPLE);
  }
  doc.rect(px, y, planW, cardH).fill(p.highlight ? NAVY : LAVBG);
  if (!p.highlight) doc.rect(px, y, planW, cardH).stroke(BORDER).lineWidth(0.5);
  doc.rect(px, y, planW, 4).fill(p.color);

  if (p.highlight) {
    doc.rect(px + planW - 54, y + 8, 46, 14).fill(PURPLE);
    doc.font('Helvetica-Bold').fontSize(7).fillColor(WHITE)
       .text('RECOMMENDED', px + planW - 54, y + 12, { width: 46, align: 'center', characterSpacing: 0.4 });
  }

  const nameColor = p.highlight ? WHITE : NAVY;
  const subColor  = p.highlight ? LILAC : GRAY;
  const priceColor = p.highlight ? WHITE : PURPLE;
  const detailColor = p.highlight ? '#C7D2FE' : '#374151';

  doc.font('Helvetica-Bold').fontSize(13).fillColor(nameColor).text(p.name, px + 12, y + 16);
  doc.font('Helvetica-Bold').fontSize(28).fillColor(priceColor).text(p.price, px + 12, y + 34);
  doc.font('Helvetica').fontSize(10).fillColor(subColor).text(p.period + ' · billed monthly', px + 12, y + 66);

  doc.moveTo(px + 12, y + 82).lineTo(px + planW - 12, y + 82)
     .strokeColor(p.highlight ? '#3730A3' : BORDER).lineWidth(0.5).stroke();

  doc.font('Helvetica').fontSize(9).fillColor(detailColor)
     .text(p.intakes, px + 12, y + 90);
  doc.font('Helvetica').fontSize(9).fillColor(detailColor)
     .text(p.seats, px + 12, y + 105);
  doc.font('Helvetica').fontSize(8).fillColor(subColor)
     .text(p.note, px + 12, y + 120);
}
y += 160;

// Enterprise row
doc.rect(ML, y, TW, 32).fill(LAVBG).stroke(BORDER).lineWidth(0.5);
doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY).text('Enterprise', ML + 14, y + 10);
doc.font('Helvetica').fontSize(9).fillColor(GRAY)
   .text('Unlimited intakes · Unlimited seats · Custom contract · Contact for pricing', ML + 90, y + 11, { width: TW - 110 });
y += 44;

// ── FUTURE PRICING ─────────────────────────────────────────────────────────
y = sectionLabel('FUTURE MARKET PRICING — 12–18 MONTHS POST PRODUCT-MARKET FIT', y);

const futCols = [ML, ML + TW / 3 + 6, ML + (TW / 3) * 2 + 12];
const futPlans = [
  ['Solo', '$199 → $299/mo', '+$100 after PMF'],
  ['Practice', '$499 → $599/mo', '+$100 after PMF'],
  ['Firm', '$899 → $999/mo', '+$100 after PMF'],
];
const fColW = TW / 3 - 6;
for (let i = 0; i < futPlans.length; i++) {
  const [name, price, note] = futPlans[i];
  const fx = futCols[i];
  doc.rect(fx, y, fColW, 52).fill(WHITE).stroke(BORDER).lineWidth(0.5);
  doc.rect(fx, y, fColW, 52).stroke(BORDER);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(MUTED).text(name, fx + 10, y + 8);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(price, fx + 10, y + 22);
  doc.font('Helvetica').fontSize(8).fillColor(GREEN).text(note, fx + 10, y + 38);
}
y += 64;

// ── BETA PILOT OFFER ───────────────────────────────────────────────────────
y = sectionLabel('BETA PILOT OFFER — FIRST 5 FIRMS ONLY', y);

doc.rect(ML, y, TW, 88).fill(NAVY);
doc.rect(ML, y, 4, 88).fill(GREEN);

doc.font('Helvetica-Bold').fontSize(13).fillColor(WHITE)
   .text('60 Days Free  ·  Full Practice Access  ·  No Credit Card', ML + 16, y + 10, { width: TW - 32 });
doc.moveTo(ML + 16, y + 30).lineTo(W - ML - 16, y + 30).strokeColor('#3730A3').lineWidth(0.5).stroke();

const offerCols = [
  ['What they get', 'Full Practice plan ($499 value) · Direct founder onboarding · No commitment'],
  ['What we ask', 'Monthly feedback call · Permission to use as a case study'],
  ['After 60 days', 'Convert to paid Practice at $499/mo or negotiate plan'],
];
let oy = y + 36;
for (const [label, val] of offerCols) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(LILAC).text(label + ':', ML + 16, oy);
  doc.font('Helvetica').fontSize(9).fillColor(WHITE).text(val, ML + 16, oy + 11, { width: TW - 32 });
  oy += 16;
}
y += 100;

// Math close
y = callout(
  'The math close: 3 hrs attorney time × $350/hr = $1,050 value. Practice plan = $499/mo. ROI before the end of the first case.',
  y, GREEN
);

pageFooter();

// ═══════════════════════════════════════════════════════════════════════════
// PAGE 2 — COMMISSION STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════
doc.addPage();
pageHeader('Founding Sales Partner Commission Structure', 2, 2);
y = 84;

y = sectionLabel('FOUNDING SALES PARTNER PROGRAM', y);

// Two-part structure
doc.rect(ML, y, TW, 62).fill(LAVBG).stroke(BORDER).lineWidth(0.5);
doc.rect(ML, y, 4, 62).fill(PURPLE);
doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text('How commission works — two parts', ML + 16, y + 10);

const part1X = ML + 16;
const part2X = ML + TW / 2 + 8;
const pColW  = TW / 2 - 28;

doc.rect(part1X, y + 26, pColW, 26).fill(PURPLE);
doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE)
   .text('20% of first paid month', part1X + 8, y + 30, { width: pColW - 12 });
doc.font('Helvetica').fontSize(8).fillColor('#C7D2FE')
   .text('Paid when the firm pays — upfront', part1X + 8, y + 43, { width: pColW - 12 });

doc.rect(part2X, y + 26, pColW, 26).fill(INDIGO);
doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE)
   .text('5% trail for 24 months', part2X + 8, y + 30, { width: pColW - 12 });
doc.font('Helvetica').fontSize(8).fillColor('#C7D2FE')
   .text('Every month the firm stays subscribed', part2X + 8, y + 43, { width: pColW - 12 });
y += 74;

// Earnings table
y = sectionLabel('WHAT TAD EARNS PER PLAN CLOSED', y);

const tHeaders = ['Plan', 'Monthly Price', 'Month 1 (20%)', 'Months 2–24 (5%/mo)', 'Total 24-Month Earnings'];
const tRows = [
  ['Solo',     '$199/mo', '$39.80',  '$9.95/mo',  '~$278'],
  ['Practice', '$499/mo', '$99.80',  '$24.95/mo', '~$698'],
  ['Firm',     '$899/mo', '$179.80', '$44.95/mo', '~$1,258'],
];
const tCols = [ML, ML + 80, ML + 180, ML + 300, ML + 428];
const tWidths = [76, 96, 116, 124, TW - 378];

// Header row
doc.rect(ML, y, TW, 20).fill(NAVY);
for (let i = 0; i < tHeaders.length; i++) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
     .text(tHeaders[i], tCols[i] + 4, y + 6, { width: tWidths[i] - 4 });
}
y += 20;

for (let r = 0; r < tRows.length; r++) {
  const row = tRows[r];
  const isHighlight = r === 1;
  doc.rect(ML, y, TW, 26).fill(isHighlight ? LIGHT : (r % 2 === 0 ? '#FAFBFF' : WHITE));
  if (isHighlight) doc.rect(ML, y, 3, 26).fill(PURPLE);
  for (let i = 0; i < row.length; i++) {
    const isBold = i === 0 || i === 4;
    const color  = i === 4 ? GREEN : (i === 2 ? PURPLE : DARK);
    doc.font(isBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(color)
       .text(row[i], tCols[i] + 4, y + 8, { width: tWidths[i] - 4 });
  }
  y += 26;
}
y += 14;

// Milestone bonuses
y = sectionLabel('MILESTONE BONUSES — PAID ON TOP OF COMMISSION', y);

const milestones = [
  { firms: '5 firms closed',  bonus: '$500',    color: INDIGO },
  { firms: '10 firms closed', bonus: '$1,000',  color: PURPLE },
  { firms: '25 firms closed', bonus: '$2,500',  color: GREEN  },
];

const mColW = TW / 3 - 6;
for (let i = 0; i < milestones.length; i++) {
  const m = milestones[i];
  const mx = ML + i * (mColW + 9);
  doc.rect(mx, y, mColW, 68).fill(LAVBG).stroke(BORDER).lineWidth(0.5);
  doc.rect(mx, y, mColW, 4).fill(m.color);
  doc.font('Helvetica-Bold').fontSize(22).fillColor(m.color).text(m.bonus, mx + 12, y + 14);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY).text(m.firms, mx + 12, y + 42);
  doc.font('Helvetica').fontSize(8).fillColor(GRAY).text('One-time bonus payment', mx + 12, y + 55);
}
y += 82;

// Path to Head of Sales
y = sectionLabel('PATH TO HEAD OF SALES — PERFORMANCE BASED', y);

doc.rect(ML, y, TW, 82).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE)
   .text('Head of Sales Role', ML + 16, y + 10);
doc.moveTo(ML + 16, y + 28).lineTo(W - ML - 16, y + 28).strokeColor('#3730A3').lineWidth(0.5).stroke();

const hosCols = [
  ['Base salary', '$4,000–$6,000/mo'],
  ['Personal closes', '10% commission'],
  ['Team override', '2% on all reps managed'],
  ['Equity', 'Conversation when role is earned'],
];
let hx = ML + 16;
for (const [label, val] of hosCols) {
  const hw = TW / 4 - 8;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(LILAC).text(label, hx, y + 36, { width: hw });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE).text(val, hx, y + 50, { width: hw });
  hx += hw + 8;
}
doc.font('Helvetica').fontSize(8).fillColor('#818CF8')
   .text('Unlocked after consistent pipeline performance — not a title, an earned role.', ML + 16, y + 68, { width: TW - 32 });
y += 96;

// Final reminder
y = callout(
  'Commission is designed to be simple: close a firm, get paid immediately, keep getting paid as long as they stay. No complicated tiers. No quarterly resets.',
  y, PURPLE
);

pageFooter();

doc.end();
console.log('Pricing & commission PDF written to', OUT);
