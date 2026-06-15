const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'one3seven-revenue-projection.pdf');
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
const GREEN  = '#059669';
const GOLD   = '#D97706';

// ── HEADER ───────────────────────────────────────────────────────────────────
doc.rect(0, 0, W, 90).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(26).fillColor(WHITE).text('one3Seven', 50, 24);
doc.font('Helvetica').fontSize(10).fillColor('#A5B4FC')
   .text('Revenue Projection — Months 1 through 6', 50, 56);
doc.font('Helvetica').fontSize(9).fillColor('#6366F1')
   .text('Confidential — For Partner & Network Discussion Only', W - 310, 60, { width: 260, align: 'right' });

// ── ASSUMPTION STRIP ──────────────────────────────────────────────────────────
let y = 104;
doc.font('Helvetica-Bold').fontSize(9).fillColor(INDIGO)
   .text('MODEL ASSUMPTIONS', 50, y, { characterSpacing: 1.2 });
y += 14;
doc.moveTo(50, y).lineTo(W - 50, y).strokeColor(LIGHT).lineWidth(1).stroke();
y += 10;

const assumptions = [
  'Solo plan $199/mo  |  Practice plan $499/mo  |  Firm plan $899/mo',
  'Average blended price used for projection: $532/mo per firm (mix of Solo, Practice, Firm)',
  'Sales cycle: 30-45 days from first demo to paid account',
  'Monthly churn assumed at 0% during beta — firms are hand-selected, high-touch onboarding',
  'No enterprise, API licensing, or white-label deals included — material upside not modeled',
];

doc.font('Helvetica').fontSize(9).fillColor(DARK);
for (const a of assumptions) {
  doc.circle(56, y + 4, 2.5).fill(INDIGO);
  doc.fillColor(DARK).text(a, 65, y, { width: W - 115 });
  y += 15;
}

// ── MILESTONE TABLE ───────────────────────────────────────────────────────────
y += 8;
doc.font('Helvetica-Bold').fontSize(9).fillColor(INDIGO)
   .text('GROWTH MILESTONES & CASH IN YOUR POCKET', 50, y, { characterSpacing: 1.2 });
y += 14;
doc.moveTo(50, y).lineTo(W - 50, y).strokeColor(LIGHT).lineWidth(1).stroke();
y += 10;

const xs   = [50, 180, 270, 360, 450];
const cols = [130, 90, 90, 90, 110];
const headers = ['Milestone', 'Firms', 'MRR', 'ARR Run Rate', '6-Mo Cash In'];

doc.rect(50, y, W - 100, 20).fill(NAVY);
headers.forEach((h, i) => {
  doc.font('Helvetica-Bold').fontSize(9).fillColor(WHITE)
     .text(h, xs[i] + 4, y + 5, { width: cols[i] - 4 });
});
y += 20;

// blended avg $532
const rows = [
  { label: 'Beta launch',    firms: 3,  mrr: 1596,  ann: 19152,  cash: 4788   },
  { label: 'Early traction', firms: 5,  mrr: 2660,  ann: 31920,  cash: 10640  },
  { label: 'Growing',        firms: 10, mrr: 5320,  ann: 63840,  cash: 26600  },
  { label: 'Momentum',       firms: 15, mrr: 7980,  ann: 95760,  cash: 47880  },
  { label: 'Scaling',        firms: 25, mrr: 13300, ann: 159600, cash: 93100  },
  { label: 'Growth stage',   firms: 40, mrr: 21280, ann: 255360, cash: 170240 },
  { label: 'Series-ready',   firms: 60, mrr: 31920, ann: 383040, cash: 287280 },
];

const fmt = (n) => '$' + n.toLocaleString('en-US');

rows.forEach((row, i) => {
  const bg = i % 2 === 0 ? '#FAFAFA' : WHITE;
  doc.rect(50, y, W - 100, 22).fill(bg);
  const isGold = row.firms >= 25;

  doc.font(isGold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5)
     .fillColor(isGold ? GOLD : DARK)
     .text(row.label, xs[0] + 4, y + 6, { width: cols[0] - 4 });
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
     .text(row.firms.toString(), xs[1] + 4, y + 6, { width: cols[1] - 4 });
  doc.font('Helvetica').fontSize(9.5).fillColor(GREEN)
     .text(fmt(row.mrr), xs[2] + 4, y + 6, { width: cols[2] - 4 });
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
     .text(fmt(row.ann), xs[3] + 4, y + 6, { width: cols[3] - 4 });
  doc.font('Helvetica-Bold').fontSize(9.5)
     .fillColor(isGold ? GOLD : INDIGO)
     .text(fmt(row.cash), xs[4] + 4, y + 6, { width: cols[4] - 4 });

  y += 22;
});

y += 6;
doc.font('Helvetica-Oblique').fontSize(8).fillColor(GRAY)
   .text('* 6-Mo Cash In = cumulative MRR received if firms onboard linearly across 6 months. Assumes no churn.', 50, y, { width: W - 100 });

// ── VALUE COMPARISON ─────────────────────────────────────────────────────────
y += 18;
doc.font('Helvetica-Bold').fontSize(9).fillColor(INDIGO)
   .text('WHAT FIRMS ARE ACTUALLY BUYING', 50, y, { characterSpacing: 1.2 });
y += 14;
doc.moveTo(50, y).lineTo(W - 50, y).strokeColor(LIGHT).lineWidth(1).stroke();
y += 10;

const comparisons = [
  ['Intake coordinator labor', '$3,000-5,000/mo', 'one3Seven replaces the intake organization step entirely'],
  ['Attorney review time (3 hrs)', '$1,050/mo', 'At $350/hr — one3Seven organizes before the first call'],
  ['Legal assistant screening', '$2,000-3,500/mo', 'AI does the pre-screen, attorney reviews a clean packet'],
];

const cx = [50, 230, 350];
doc.rect(50, y, W - 100, 18).fill(NAVY);
['Comparison', 'Est. Monthly Cost', 'What one3Seven Replaces'].forEach((h, i) => {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text(h, cx[i] + 4, y + 4);
});
y += 18;

comparisons.forEach(([label, cost, note], i) => {
  doc.rect(50, y, W - 100, 20).fill(i % 2 === 0 ? '#FAFAFA' : WHITE);
  doc.font('Helvetica').fontSize(9).fillColor(DARK).text(label, cx[0] + 4, y + 5);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN).text(cost, cx[1] + 4, y + 5);
  doc.font('Helvetica').fontSize(9).fillColor(GRAY).text(note, cx[2] + 4, y + 5, { width: W - cx[2] - 60 });
  y += 20;
});

// ── PARTNER BOX ───────────────────────────────────────────────────────────────
y += 12;
const boxH = 80;
doc.rect(50, y, W - 100, boxH).fill(LIGHT);
doc.rect(50, y, 5, boxH).fill(INDIGO);

doc.font('Helvetica-Bold').fontSize(12).fillColor(NAVY)
   .text('Be Part of What Is Being Built', 68, y + 10, { width: W - 140 });
doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text(
     'one3Seven is in active beta with a working product and real intakes. We are looking for network partners, ' +
     'sales collaborators, and firm connectors who want early equity or commission stake in a legal tech company ' +
     'moving in the direction the entire industry is heading.',
     68, y + 28, { width: W - 140 }
   );

// ── FOOTER ────────────────────────────────────────────────────────────────────
doc.rect(0, H - 42, W, 42).fill(NAVY);
doc.font('Helvetica').fontSize(9).fillColor('#A5B4FC')
   .text(
     'one3seven-beta.vercel.app  ·  hello@one3seven.com  ·  Projections are forward-looking estimates, not guarantees.',
     50, H - 26, { width: W - 100, align: 'center' }
   );

doc.end();
console.log('Revenue PDF written to', OUT);
