const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'one3seven-outreach.pdf');
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

function sectionHead(label, y) {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INDIGO)
     .text(label, 50, y, { characterSpacing: 1.1 });
  doc.moveTo(50, y + 13).lineTo(W - 50, y + 13).strokeColor(LIGHT).lineWidth(1).stroke();
  return y + 22;
}

// ── HEADER ────────────────────────────────────────────────────────────────────
doc.rect(0, 0, W, 96).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(26).fillColor(WHITE).text('one3Seven', 50, 22);
doc.font('Helvetica').fontSize(11).fillColor('#A5B4FC')
   .text('Intake Review for Employment Law Firms', 50, 56);
doc.font('Helvetica').fontSize(9).fillColor('#4F46E5')
   .text('Partner & Network Overview', W - 220, 62, { width: 170, align: 'right' });

// ── 10-SECOND STATEMENT ───────────────────────────────────────────────────────
let y = 112;
doc.rect(50, y, W - 100, 52).fill(INDIGO);
doc.font('Helvetica-Bold').fontSize(14).fillColor(WHITE)
   .text('Reduce employment intake review from 45 minutes to under 5.', 68, y + 10, { width: W - 136 });
doc.font('Helvetica').fontSize(10).fillColor('#C7D2FE')
   .text('Without replacing your staff, your process, or your judgment.', 68, y + 32, { width: W - 136 });
y += 66;

// ── THE PROBLEM ───────────────────────────────────────────────────────────────
y = sectionHead('WHAT YOUR INTAKE COORDINATOR IS DOING RIGHT NOW', y);

const problems = [
  ['Sorting documents', 'Pay stubs, HR emails, warning letters, texts — arriving in every format, from every direction.'],
  ['Building a timeline manually', 'Writing out what happened, when, based on reading 12 files in no particular order.'],
  ['Deciding what matters', 'Spending 30–45 minutes per intake before an attorney can even start evaluating the case.'],
  ['Missing cases', 'High volume + limited review time = good cases declined because there was no capacity to look.'],
];

for (const [bold, rest] of problems) {
  doc.circle(57, y + 5, 3).fill('#DC2626');
  doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
     .text(bold + '  ', 68, y, { continued: true, width: W - 118 });
  doc.font('Helvetica').fillColor(GRAY).text(rest);
  y += 22;
}

// ── WHAT ARRIVES INSTEAD ──────────────────────────────────────────────────────
y += 6;
y = sectionHead('WHAT ARRIVES IN YOUR FIRM\'S REVIEW QUEUE INSTEAD', y);

doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text(
     'The worker submits their records and describes their situation. one3Seven reads everything and ' +
     'prepares a single organized review packet before your attorney opens a single file.',
     50, y, { width: W - 100 }
   );
y += 36;

// What's in the packet
const packet = [
  { label: 'Chronological timeline',    detail: 'Dates and events in order — with each event linked to its source record',          color: INDIGO },
  { label: 'Records already categorized', detail: 'HR communications, payroll, discipline, scheduling, separation — sorted on arrival', color: INDIGO },
  { label: 'Key facts extracted',        detail: 'Termination reason, complaint date, warning reason — from the documents themselves', color: GREEN  },
  { label: 'Priority review list',       detail: '"Start here" — the 3–4 records that matter most, ranked before you open anything',  color: GREEN  },
  { label: 'Gaps flagged',               detail: 'What exists, what is missing, what needs confirmation — before the first call',     color: GOLD   },
];

for (const item of packet) {
  doc.circle(57, y + 5, 3).fill(item.color);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK)
     .text(item.label + '  ', 68, y, { continued: true, width: W - 118 });
  doc.font('Helvetica').fillColor(GRAY).text(item.detail);
  y += 20;
}

// ── THE RECORD TRUST BOX ──────────────────────────────────────────────────────
y += 8;
doc.rect(50, y, W - 100, 52).fill(LIGHT);
doc.rect(50, y, 5, 52).fill(GREEN);
doc.font('Helvetica-Bold').fontSize(10).fillColor(NAVY)
   .text('Every fact points back to a record.', 68, y + 8, { width: W - 140 });
doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
   .text(
     'one3Seven does not give opinions. It shows what the documents say and where they say it. ' +
     'Your attorney reviews the records. Your attorney decides what matters.',
     68, y + 24, { width: W - 140 }
   );
y += 64;

// ── THE MATH ──────────────────────────────────────────────────────────────────
y = sectionHead('THE STAFFING MATH', y);

const mathRows = [
  ['Intake coordinator time saved',    '30–40 min per intake',   'Sorting, organizing, timeline building — eliminated'],
  ['Attorney pre-review time saved',   '20–30 min per intake',   'Attorney opens an organized packet, not a pile of files'],
  ['At 20 intakes per month',          '8–11 hours recovered',   'Per month, per firm — without adding headcount'],
  ['one3Seven Practice plan',          '$499/month',              'Less than one hour of attorney time at $350/hr'],
];

const mc = [50, 220, 330];
doc.rect(50, y, W - 100, 18).fill(NAVY);
['What Changes', 'Time Saved', 'What That Means'].forEach((h, i) => {
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(WHITE).text(h, mc[i] + 4, y + 4);
});
y += 18;

mathRows.forEach(([what, time, meaning], i) => {
  doc.rect(50, y, W - 100, 22).fill(i % 2 === 0 ? '#FAFAFA' : WHITE);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(DARK).text(what, mc[0] + 4, y + 6, { width: 165 });
  doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN).text(time, mc[1] + 4, y + 6, { width: 105 });
  doc.font('Helvetica').fontSize(8.5).fillColor(GRAY).text(meaning, mc[2] + 4, y + 6, { width: W - mc[2] - 60 });
  y += 22;
});

// ── WORKER CONSENT ────────────────────────────────────────────────────────────
y += 12;
y = sectionHead('THE CONSENT MODEL — WHAT FIRMS AND WORKERS BOTH NEED TO HEAR', y);

doc.font('Helvetica').fontSize(10).fillColor(DARK)
   .text(
     'Workers control access. A firm sees the intake organization — timeline, categories, record counts — ' +
     'before approving access. The worker approves. Then the firm sees the full packet. ' +
     'Every access event is logged and timestamped.',
     50, y, { width: W - 100 }
   );
y += 42;

// ── WHO BUYS ──────────────────────────────────────────────────────────────────
y = sectionHead('WHO THIS IS FOR', y);

const buyers = [
  ['Managing Partner',         'Wants fewer staff hours spent on intake triage. Wants more cases evaluated per week.'],
  ['Practice Manager / Ops',   'Wants a repeatable intake process that does not depend on one coordinator\'s system.'],
  ['Intake Director',          'Wants organized records waiting when they open a new intake — not a sorting project.'],
];

for (const [role, desc] of buyers) {
  doc.circle(57, y + 5, 3).fill(GOLD);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
     .text(role + '  ', 68, y, { continued: true });
  doc.font('Helvetica').fillColor(GRAY).text('— ' + desc, { width: W - 118 });
  y += 20;
}

// ── BETA OFFER ────────────────────────────────────────────────────────────────
y += 8;
doc.rect(50, y, W - 100, 54).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE)
   .text('Beta Pilot — First 5 Firms', 68, y + 10, { width: W - 136 });
doc.font('Helvetica').fontSize(10).fillColor('#A5B4FC')
   .text(
     '60 days free. Full access. Direct founder onboarding. No credit card. ' +
     'Use it on real intakes and tell us what you think.',
     68, y + 28, { width: W - 136 }
   );

// ── FOOTER ────────────────────────────────────────────────────────────────────
doc.rect(0, H - 36, W, 36).fill(INDIGO);
doc.font('Helvetica').fontSize(9).fillColor(WHITE)
   .text(
     'one3seven-beta.vercel.app  ·  hello@one3seven.com  ·  Time estimates based on typical employment intake workflows.',
     50, H - 22, { width: W - 100, align: 'center' }
   );

doc.end();
console.log('Outreach PDF written to', OUT);
