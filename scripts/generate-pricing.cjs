const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'one3seven-pricing.pdf');
const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
doc.pipe(fs.createWriteStream(OUT));

const W = 612;
const H = 792;

const NAVY   = '#1E1B4B';
const INDIGO = '#6366F1';
const LIGHT  = '#EEF2FF';
const WHITE  = '#FFFFFF';
const GRAY   = '#6B7280';
const DARK   = '#111827';
const GREEN  = '#10B981';

// ── HEADER ───────────────────────────────────────────────────────────────────
doc.rect(0, 0, W, 110).fill(NAVY);

doc.font('Helvetica-Bold').fontSize(28).fillColor(WHITE)
   .text('one3Seven', 50, 32);
doc.font('Helvetica').fontSize(11).fillColor('#A5B4FC')
   .text('Intake Intelligence Platform', 50, 64);
doc.font('Helvetica-Oblique').fontSize(11).fillColor('#C7D2FE')
   .text('Organized. Secure. Ready for review.', 50, 82);
doc.font('Helvetica').fontSize(9).fillColor('#818CF8')
   .text('Beta — June 2026', W - 140, 46, { width: 100, align: 'right' });

// ── BETA PILOT OFFER (top) ────────────────────────────────────────────────────
let y = 126;
const offerH = 66;
doc.rect(50, y, W - 100, offerH).fill(LIGHT);
doc.rect(50, y, 5, offerH).fill(INDIGO);

doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY)
   .text('Beta Pilot — First 5 Firms Only', 68, y + 10, { width: W - 140 });
doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text('Free for 60 days. Full Practice access. Direct founder onboarding. No credit card required.', 68, y + 28, { width: W - 140 });
doc.font('Helvetica-Oblique').fontSize(9).fillColor(GRAY)
   .text('Requirements: monthly feedback call  ·  permission to use feedback as case study  ·  beta agreement', 68, y + 46, { width: W - 140 });

// ── WHAT YOU GET ──────────────────────────────────────────────────────────────
y += offerH + 18;
doc.font('Helvetica-Bold').fontSize(9).fillColor(INDIGO)
   .text('INCLUDED ON EVERY PLAN', 50, y, { characterSpacing: 1.2 });
y += 14;
doc.moveTo(50, y).lineTo(W - 50, y).strokeColor(LIGHT).lineWidth(1).stroke();
y += 10;

const included = [
  'Worker submits intake with documents directly — no attorney time required',
  'AI organizes timeline, supporting records, and clarifications needed',
  'Firm review screen with At-a-Glance summary card',
  'Downloadable PDF review packet for every intake',
  'Worker consent model — firm only sees what the worker approves',
  'Secure document handling — encrypted, access-controlled, audit-logged',
];

for (const item of included) {
  doc.circle(57, y + 4, 3).fill(GREEN);
  doc.font('Helvetica').fontSize(10).fillColor(DARK)
     .text(item, 68, y, { width: W - 118 });
  y += 18;
}

// ── PRICING PLANS ─────────────────────────────────────────────────────────────
y += 10;
doc.font('Helvetica-Bold').fontSize(9).fillColor(INDIGO)
   .text('BETA PRICING — PAID PLANS', 50, y, { characterSpacing: 1.2 });
y += 14;
doc.moveTo(50, y).lineTo(W - 50, y).strokeColor(LIGHT).lineWidth(1).stroke();
y += 14;

const plans = [
  {
    name: 'Solo',
    price: '$199',
    highlight: false,
    features: ['15 intakes / month', '1 seat', 'AI intake organization', 'PDF export', 'Standard support'],
    best: 'Solo plaintiff attorneys',
  },
  {
    name: 'Practice',
    price: '$499',
    highlight: true,
    features: ['50 intakes / month', '3 seats', 'Full intelligence layer', 'Clarifications & timeline', 'Priority support'],
    best: 'Firms with 2 to 5 attorneys',
  },
  {
    name: 'Firm',
    price: '$899',
    highlight: false,
    features: ['Unlimited intakes', '10 seats', 'Full intelligence layer', 'Priority onboarding', 'Dedicated support'],
    best: 'Growing employment firms',
  },
];

const colW = (W - 100) / 3;
const cardH = 172;

plans.forEach((plan, i) => {
  const x = 50 + i * colW;
  const pad = 4;

  if (plan.highlight) {
    doc.rect(x + pad + 2, y + 2, colW - pad * 2, cardH).fill('#C7D2FE');
    doc.rect(x + pad, y, colW - pad * 2, cardH).fill(INDIGO);
  } else {
    doc.rect(x + pad, y, colW - pad * 2, cardH).fill('#F9FAFB').stroke('#E5E7EB');
  }

  const textColor = plan.highlight ? WHITE : DARK;
  const subColor  = plan.highlight ? '#C7D2FE' : GRAY;
  const dotColor  = plan.highlight ? '#A5B4FC' : INDIGO;

  doc.font('Helvetica-Bold').fontSize(14).fillColor(textColor)
     .text(plan.name, x + pad + 14, y + 14, { width: colW - pad * 2 - 20 });
  doc.font('Helvetica-Bold').fontSize(24).fillColor(textColor)
     .text(plan.price, x + pad + 14, y + 34);
  doc.font('Helvetica').fontSize(9).fillColor(subColor)
     .text('per month', x + pad + 14, y + 62);

  let fy = y + 78;
  for (const feat of plan.features) {
    doc.circle(x + pad + 20, fy + 4, 2.5).fill(dotColor);
    doc.font('Helvetica').fontSize(9).fillColor(textColor)
       .text(feat, x + pad + 28, fy, { width: colW - pad * 2 - 36 });
    fy += 16;
  }

  doc.font('Helvetica-Oblique').fontSize(8).fillColor(subColor)
     .text('Best for: ' + plan.best, x + pad + 14, y + cardH - 20, { width: colW - pad * 2 - 20 });
});

y += cardH + 10;

// Enterprise row
doc.rect(50, y, W - 100, 34).fill('#F9FAFB').stroke('#E5E7EB');
doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
   .text('Enterprise', 68, y + 10);
doc.font('Helvetica').fontSize(9).fillColor(GRAY)
   .text('Unlimited intakes  ·  Unlimited seats  ·  Custom onboarding  ·  API access', 150, y + 12);
doc.font('Helvetica-Bold').fontSize(9).fillColor(INDIGO)
   .text('Contact us', W - 120, y + 12);

// Future pricing note
y += 48;
doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(GRAY)
   .text(
     'Market pricing after product-market fit (12-18 months): Solo $299  ·  Practice $599  ·  Firm $999  ·  Enterprise custom.',
     50, y, { width: W - 100 }
   );

// ── FOOTER ────────────────────────────────────────────────────────────────────
doc.rect(0, H - 42, W, 42).fill(NAVY);
doc.font('Helvetica').fontSize(9).fillColor('#A5B4FC')
   .text(
     'one3seven-beta.vercel.app  ·  hello@one3seven.com  ·  Intake intelligence built for employment attorneys.',
     50, H - 26, { width: W - 100, align: 'center' }
   );

doc.end();
console.log('Pricing PDF written to', OUT);
