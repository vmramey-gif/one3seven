// Generates the real text-layer PDF fixtures for gauntlet case D (Elena Cho, pure wage/overtime
// case). The committed PDFs in ../gauntlet-fixtures/case-d-cho/ ARE this script's output -- an
// edit here needs a matching edit to the assertions in scripts/gauntlet.mjs.
//   node scripts/gauntlet-fixtures/generate-case-d.mjs   (run from the repo root)
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'case-d-cho');

async function makeDoc(lines, title) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([612, 792]);
  let y = 792 - 72;
  const marginX = 60;
  const lineHeight = 16;
  const maxWidth = 612 - marginX * 2;

  function wrapText(text, f, size) {
    const words = text.split(' ');
    const out = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth) { if (cur) out.push(cur); cur = w; }
      else cur = test;
    }
    if (cur) out.push(cur);
    return out;
  }

  page.drawText(title, { x: marginX, y, size: 13, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  y -= lineHeight * 1.8;
  for (const raw of lines) {
    const wrapped = raw === '' ? [''] : wrapText(raw, font, 10.5);
    for (const w of wrapped) {
      if (y < 72) { page = doc.addPage([612, 792]); y = 792 - 72; }
      page.drawText(w, { x: marginX, y, size: 10.5, font, color: rgb(0.05, 0.05, 0.05) });
      y -= lineHeight;
    }
  }
  return doc.save();
}

const RATE = '$28.00';
const periods = [
  { n: 1, range: 'February 2-15, 2026', w1: '42.5', w2: '43.5', ot: '6.0', gross: '2,408.00', w1d: 'Feb 2', w2d: 'Feb 9' },
  { n: 2, range: 'February 16 - March 1, 2026', w1: '42.5', w2: '43.0', ot: '5.5', gross: '2,394.00', w1d: 'Feb 16', w2d: 'Feb 23' },
  { n: 3, range: 'March 2-15, 2026', w1: '44.0', w2: '43.0', ot: '7.0', gross: '2,436.00', w1d: 'Mar 2', w2d: 'Mar 9' },
  { n: 4, range: 'March 16-29, 2026', w1: '42.0', w2: '42.5', ot: '4.5', gross: '2,366.00', w1d: 'Mar 16', w2d: 'Mar 23' },
  { n: 5, range: 'March 30 - April 12, 2026', w1: '43.0', w2: '43.0', ot: '6.0', gross: '2,408.00', w1d: 'Mar 30', w2d: 'Apr 6' },
];

const files = [
  {
    filename: '01-offer-letter.pdf',
    title: 'Meridian Business Solutions, Inc. — Offer of Employment',
    lines: [
      'January 12, 2026',
      '',
      'Dear Elena Cho,',
      '',
      'We are pleased to offer you the position of Accounts Payable Coordinator at Meridian Business Solutions, Inc.',
      '',
      `Rate of pay: ${RATE} per hour, paid biweekly. This is a non-exempt, hourly position.`,
      'Start date: January 26, 2026.',
      'Standard schedule: Monday through Friday, 8:00 AM to 5:00 PM (8 hours/day, 40 hours/week).',
      '',
      'Please sign and return this letter to confirm your acceptance.',
      '',
      'Sincerely,',
      'Patricia Nolan, HR Director',
      'Meridian Business Solutions, Inc.',
    ],
  },
  ...periods.map((p) => ({
    filename: `0${p.n + 1}-paystub-period-${p.n}.pdf`,
    title: `Meridian Business Solutions, Inc. — Pay Stub, Pay Period ${p.range}`,
    lines: [
      'Employee: Elena Cho          Position: Accounts Payable Coordinator',
      '',
      `Week 1 (${p.w1d}): ${p.w1} hours worked`,
      `Week 2 (${p.w2d}): ${p.w2} hours worked`,
      '',
      `Regular hours: 80.0 at ${RATE}/hr`,
      `Overtime hours: ${p.ot} at ${RATE}/hr — paid at the same rate as regular hours, no overtime premium applied`,
      `Gross pay: $${p.gross}`,
      '',
      'No separate overtime rate or premium line item appears on this statement.',
    ],
  })),
];

await mkdir(OUT, { recursive: true });
for (const f of files) {
  const bytes = await makeDoc(f.lines, f.title);
  await writeFile(path.join(OUT, f.filename), bytes);
  console.log(`wrote ${f.filename}`);
}

// Ground truth for later verification
const groundTruth = {
  baseHourlyRate: 28.00,
  correctOtRate: 42.00,
  otPremiumPerHour: 14.00,
  totalOvertimeHoursUnderpaid: periods.reduce((s, p) => s + Number(p.ot), 0),
  expectedOvertimeTotalEstimate: 14.00 * periods.reduce((s, p) => s + Number(p.ot), 0),
  expectedCombinedEstimate: 14.00 * periods.reduce((s, p) => s + Number(p.ot), 0), // no meal breaks claimed in this case
};
await writeFile(path.join(OUT, 'GROUND-TRUTH.json'), JSON.stringify(groundTruth, null, 2));
console.log('\nGround truth:', JSON.stringify(groundTruth, null, 2));
