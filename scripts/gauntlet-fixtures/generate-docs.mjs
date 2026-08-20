// Generates the real text-layer PDF fixtures for gauntlet cases A/B/C (Delgado/Nakamura/Osei).
// The committed PDFs in ../gauntlet-fixtures/case-*/ ARE this script's output -- re-run it only
// if a fixture needs to change; the exact facts below are the ground truth scripts/gauntlet.mjs
// asserts against, so any edit here needs a matching edit there.
//   node scripts/gauntlet-fixtures/generate-docs.mjs   (run from the repo root; uses pdf-lib,
//   already a project dependency)
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.dirname(fileURLToPath(import.meta.url));

async function makeDoc(lines, { title, redactLineIndexes = [] } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 612;
  const pageHeight = 792;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 72;
  const marginX = 60;
  const lineHeight = 16;
  const maxWidth = pageWidth - marginX * 2;

  function wrapText(text, f, size) {
    const words = text.split(' ');
    const out = [];
    let cur = '';
    for (const w of words) {
      const test = cur ? cur + ' ' + w : w;
      if (f.widthOfTextAtSize(test, size) > maxWidth) {
        if (cur) out.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) out.push(cur);
    return out;
  }

  if (title) {
    page.drawText(title, { x: marginX, y, size: 13, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
    y -= lineHeight * 1.8;
  }

  let lineIdx = 0;
  for (const raw of lines) {
    const isRedacted = redactLineIndexes.includes(lineIdx);
    if (isRedacted) {
      // Genuine redaction: no text is embedded at all for this line — just a solid black bar.
      // This is NOT a box drawn over live text (which would leave the text extractable); there is
      // simply nothing here to extract, matching what a real redaction should guarantee.
      const barWidth = 260 + Math.random() * 180;
      if (y < 72) { page = doc.addPage([pageWidth, pageHeight]); y = pageHeight - 72; }
      page.drawRectangle({ x: marginX, y: y - 4, width: barWidth, height: lineHeight - 2, color: rgb(0, 0, 0) });
      y -= lineHeight;
      lineIdx++;
      continue;
    }
    const size = 10.5;
    const wrapped = raw === '' ? [''] : wrapText(raw, font, size);
    for (const w of wrapped) {
      if (y < 72) { page = doc.addPage([pageWidth, pageHeight]); y = pageHeight - 72; }
      page.drawText(w, { x: marginX, y, size, font, color: rgb(0.05, 0.05, 0.05) });
      y -= lineHeight;
    }
    lineIdx++;
  }
  return doc.save();
}

async function writeCase(caseDir, files) {
  await mkdir(path.join(OUT, caseDir), { recursive: true });
  for (const f of files) {
    const bytes = await makeDoc(f.lines, { title: f.title, redactLineIndexes: f.redactLineIndexes });
    await writeFile(path.join(OUT, caseDir, f.filename), bytes);
    console.log(`wrote ${caseDir}/${f.filename}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CASE A — Marcus Delgado v. Bright Horizon Logistics. 6 files. Full multi-lens
// case: §1102.5 Retaliation, Hours & Overtime §510, Final Pay §201-203.
// ─────────────────────────────────────────────────────────────────────────
const caseA = [
  {
    filename: '01-offer-letter.pdf',
    title: 'Bright Horizon Logistics — Offer of Employment',
    lines: [
      'March 3, 2025',
      '',
      'Dear Marcus Delgado,',
      '',
      'We are pleased to offer you the position of Warehouse Coordinator at Bright Horizon Logistics, reporting to the Fresno distribution facility.',
      '',
      'Rate of pay: $24.50 per hour, paid biweekly. This is a non-exempt, hourly position.',
      'Start date: March 17, 2025.',
      'Standard schedule: Monday through Friday, 7:00 AM to 3:30 PM.',
      'You will accrue paid time off (PTO) at a rate of 1 day per month, capped at 12 days per year.',
      '',
      'Please sign and return this letter to confirm your acceptance.',
      '',
      'Sincerely,',
      'Renee Ashford, HR Manager',
      'Bright Horizon Logistics',
    ],
  },
  {
    filename: '02-email-overtime-complaint.pdf',
    title: 'Email — Marcus Delgado to Renee Ashford (HR)',
    lines: [
      'From: marcus.delgado@personal-email.com',
      'To: renee.ashford@brighthorizonlogistics.com',
      'Date: June 9, 2025',
      'Subject: Overtime hours not being paid correctly',
      '',
      'Hi Renee,',
      '',
      'I wanted to raise a concern and report something I have noticed over the last two months. I have consistently been working more than 45 hours most weeks — often staying until 6 or 6:30 PM to finish pallet counts — but my paychecks only show straight-time pay for all of those hours. I have not received any overtime pay at the time-and-a-half rate for the hours over 40.',
      '',
      'I raised this informally with my supervisor, Tom Alvarez, a few weeks ago, but nothing changed on my last two paychecks, so I wanted to put this in writing and report it directly to HR. I do not think this is right and I would like it corrected.',
      '',
      'Can we set up a time to go over my timecards together?',
      '',
      'Thank you,',
      'Marcus Delgado',
    ],
  },
  {
    filename: '03-hr-reply.pdf',
    title: 'Email — Renee Ashford (HR) to Marcus Delgado',
    lines: [
      'From: renee.ashford@brighthorizonlogistics.com',
      'To: marcus.delgado@personal-email.com',
      'Date: June 10, 2025',
      'Subject: RE: Overtime hours not being paid correctly',
      '',
      'Marcus,',
      '',
      'Thank you for bringing this to our attention. We received your email and are looking into your concerns about overtime pay. I have forwarded this to payroll and will follow up once I hear back.',
      '',
      'Renee Ashford',
      'HR Manager, Bright Horizon Logistics',
    ],
  },
  {
    filename: '04-timecards-and-paystub.pdf',
    title: 'Weekly Timecards — May 26 to June 8, 2025',
    lines: [
      'Employee: Marcus Delgado          Position: Warehouse Coordinator',
      '',
      'Week of May 26: Mon 7:00-6:15, Tue 7:00-6:30, Wed 7:00-3:30, Thu 7:00-6:00, Fri 7:00-5:45',
      'Total hours worked: 47.5',
      '',
      'Week of June 2: Mon 7:00-6:00, Tue 7:00-6:15, Wed 7:00-5:30, Thu 7:00-6:30, Fri 7:00-3:30',
      'Total hours worked: 46.25',
      '',
      '— Pay Stub, Pay Period Ending June 8, 2025 —',
      'Regular hours: 80.0 at $24.50/hr = $1,960.00',
      'Overtime hours: 0.0 — no overtime rate applied this period',
      'Gross pay: $1,960.00',
      'Note: hourly rate paid straight-time for all hours recorded, including hours over 40 per week shown above.',
    ],
  },
  {
    filename: '05-termination-letter.pdf',
    title: 'Bright Horizon Logistics — Notice of Separation',
    lines: [
      'June 24, 2025',
      '',
      'Dear Marcus Delgado,',
      '',
      'This letter confirms that your employment with Bright Horizon Logistics is terminated effective today, June 24, 2025, two weeks after your June 9 email to HR about overtime pay.',
      '',
      'The stated reason for this action is restructuring of the Fresno warehouse coordinator role due to a reduction in force. Your final paycheck, including any accrued and unused PTO, will be processed separately.',
      '',
      'Renee Ashford',
      'HR Manager, Bright Horizon Logistics',
    ],
  },
  {
    filename: '06-final-paycheck-letter.pdf',
    title: 'Bright Horizon Logistics — Final Pay Notice',
    lines: [
      'July 1, 2025',
      '',
      'Marcus Delgado,',
      '',
      'Your final paycheck was mailed to your address on file on June 29, 2025, five days after your last day of June 24, 2025.',
      '',
      'Final check amount: $980.00 (40 hours at straight time). This amount does not include payment for the overtime hours worked in May and June described in your June 9 email, which remain unpaid.',
      '',
      'Accrued and unused PTO: 3 days accrued per your offer letter. No PTO payout is included in this final check.',
      '',
      'Bright Horizon Logistics Payroll',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// CASE B — Priya Nakamura v. Coastal Retail Group. 10 files. Messy: mixed
// document types, a couple of pages heavily redacted (genuinely, no hidden text).
// ─────────────────────────────────────────────────────────────────────────
const caseB = [
  {
    filename: '01-offer-letter.pdf',
    title: 'Coastal Retail Group — Offer Letter',
    lines: [
      'January 14, 2025',
      'Priya Nakamura — Assistant Store Manager, Santa Cruz location.',
      'Rate: $27.00/hour, non-exempt. Schedule varies by week, posted every Sunday.',
      'Reports to Store Manager, Diego Ferreira.',
    ],
  },
  {
    filename: '02-hr-complaint-email-partially-redacted.pdf',
    title: 'Email — Priya Nakamura to HR',
    redactLineIndexes: [6, 7],
    lines: [
      'From: priya.nakamura@personal-email.com',
      'To: hr@coastalretailgroup.com',
      'Date: April 2, 2025',
      'Subject: Complaint about scheduling and treatment by Diego Ferreira',
      '',
      'I am writing to file a complaint about how I have been treated by my manager, Diego Ferreira, over the last month.',
      '', // redacted
      '', // redacted
      'I am asking HR to look into this.',
      '',
      'Priya Nakamura',
    ],
  },
  {
    filename: '03-hr-ack.pdf',
    title: 'Email — HR to Priya Nakamura',
    lines: [
      'Date: April 3, 2025',
      'Priya, we received your complaint and are looking into it. We will follow up soon.',
      'Coastal Retail Group HR',
    ],
  },
  {
    filename: '04-written-warning-heavily-redacted.pdf',
    title: 'Coastal Retail Group — Written Warning',
    redactLineIndexes: [1, 2, 3, 4, 5],
    lines: [
      'Date: April 18, 2025',
      '', // redacted
      '', // redacted
      '', // redacted
      '', // redacted
      '', // redacted
      'Issued by: Diego Ferreira, Store Manager',
    ],
  },
  {
    filename: '05-timecard-march.pdf',
    title: 'Timecard — March 2025',
    lines: [
      'Employee: Priya Nakamura',
      'Week of March 3: 38.5 hours',
      'Week of March 10: 41.0 hours — no overtime line item on paystub',
      'Week of March 17: 36.0 hours',
      'Week of March 24: 40.5 hours',
    ],
  },
  {
    filename: '06-paystub-march.pdf',
    title: 'Pay Stub — Pay Period March 1-31, 2025',
    lines: [
      'Regular hours: 156.0 at $27.00/hr = $4,212.00',
      'Overtime hours: 0.0',
      'Gross pay: $4,212.00',
    ],
  },
  {
    filename: '07-schedule-screenshot-text.pdf',
    title: 'Posted Schedule — Week of April 7',
    lines: [
      'Mon 9-6, Tue 9-6, Wed off, Thu 9-6, Fri 9-6, Sat 10-4',
      'No meal break marked on Saturday shift.',
    ],
  },
  {
    filename: '08-text-message-export.pdf',
    title: 'Text Messages — Priya Nakamura and Diego Ferreira',
    lines: [
      'Diego (Apr 20, 2025, 8:14 AM): We need to talk about your hours today.',
      'Priya (Apr 20, 2025, 8:20 AM): Okay, I can come in early.',
      'Diego (Apr 22, 2025, 5:02 PM): Your schedule is being reduced starting next week.',
    ],
  },
  {
    filename: '09-separation-letter.pdf',
    title: 'Coastal Retail Group — Notice of Separation',
    lines: [
      'May 6, 2025',
      'Priya Nakamura, your employment is terminated effective today, May 6, 2025.',
      'Stated reason: performance.',
      'This is about five weeks after your April 2 complaint to HR.',
    ],
  },
  {
    filename: '10-illegible-scan-note.pdf',
    title: 'Handwritten Note (poor scan quality)',
    lines: [
      '[This page is a photo of a handwritten note. Most of the handwriting is illegible in the scan.]',
      '...cant keep doing this... talk to someone...',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// CASE C — David Osei v. Vantage Health Partners. 15 files. Volume/scale case:
// repetitive wage statements across many months, meal/rest break pattern.
// ─────────────────────────────────────────────────────────────────────────
const monthsC = [
  'January 2025', 'February 2025', 'March 2025', 'April 2025', 'May 2025',
  'June 2025', 'July 2025', 'August 2025', 'September 2025', 'October 2025',
  'November 2025', 'December 2025',
];
const caseC = [
  {
    filename: '01-offer-letter.pdf',
    title: 'Vantage Health Partners — Offer Letter',
    lines: [
      'December 2, 2024',
      'David Osei — Patient Care Technician, non-exempt, $26.00/hour.',
      '12-hour shifts, 3 days per week. Meal and rest breaks per state policy (see handbook).',
    ],
  },
  ...monthsC.map((m, i) => ({
    filename: `${String(i + 2).padStart(2, '0')}-paystub-${m.replace(' ', '-').toLowerCase()}.pdf`,
    title: `Pay Stub — ${m}`,
    lines: [
      'Employee: David Osei',
      `Pay period: ${m}`,
      'Regular hours: 144.0 at $26.00/hr',
      'Meal premium pay: $0.00',
      'Rest premium pay: $0.00',
      'No meal or rest break premium line items appear on this statement despite 12-hour shifts.',
    ],
  })),
  {
    filename: '14-shift-log-sample.pdf',
    title: 'Shift Log Sample — March 2025',
    lines: [
      'David Osei, 12-hour shifts, March 3/5/7, March 10/12/14.',
      'Meal period: "worked through, too short-staffed to leave the floor" noted on 4 of 6 shifts.',
      'Rest periods: not tracked separately in this system.',
    ],
  },
  {
    filename: '15-hr-inquiry-response.pdf',
    title: 'Email — Vantage Health Partners HR to David Osei',
    lines: [
      'Date: December 18, 2025',
      'David, in response to your question: our policy is that meal breaks should be taken, but coverage on the floor is prioritized during short-staffed shifts.',
      'Vantage Health Partners HR',
    ],
  },
];

await writeCase('case-a-delgado', caseA);
await writeCase('case-b-nakamura', caseB);
await writeCase('case-c-osei', caseC);
console.log('\nDone.');
