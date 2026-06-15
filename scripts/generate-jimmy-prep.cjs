const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'one3seven-jimmy-prep.pdf');
const doc = new PDFDocument({ size: 'LETTER', margin: 0 });
doc.pipe(fs.createWriteStream(OUT));

const W = 612;
const H = 792;
const NAVY   = '#1E1B4B';
const INDIGO = '#6366F1';
const PURPLE = '#6D4AFF';
const LIGHT  = '#EEF2FF';
const WHITE  = '#FFFFFF';
const GRAY   = '#6B7280';
const DARK   = '#111827';
const GREEN  = '#059669';
const AMBER  = '#D97706';

// ── HEADER ─────────────────────────────────────────────────────────────────
doc.rect(0, 0, W, 80).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(20).fillColor(WHITE).text('Tad × Jimmy', 50, 18);
doc.font('Helvetica').fontSize(10.5).fillColor('#A5B4FC')
   .text('30–60 min conversation prep — one3Seven', 50, 46);
doc.font('Helvetica').fontSize(9).fillColor('#4F46E5')
   .text('Extract knowledge. Do not pitch.', W - 230, 50, { width: 180, align: 'right' });

// ── OPENING SCRIPT ─────────────────────────────────────────────────────────
let y = 96;
doc.rect(50, y, W - 100, 58).fill(PURPLE);
doc.font('Helvetica-Bold').fontSize(8).fillColor('#C7D2FE')
   .text('SAY THIS IN THE FIRST 60 SECONDS', 66, y + 9, { characterSpacing: 0.9 });
doc.font('Helvetica').fontSize(10).fillColor(WHITE)
   .text(
     '"Victoria and I built a platform called one3Seven. Workers upload records and tell their story. The platform organizes everything into a firm review experience. We\'re not pitching today — we want your honest reaction from someone who knows how firms actually think."',
     66, y + 22, { width: W - 132 }
   );
y += 70;

// ── THE ONE QUESTION ──────────────────────────────────────────────────────
doc.rect(50, y, W - 100, 48).fill(LIGHT);
doc.rect(50, y, 5, 48).fill(GREEN);
doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY)
   .text('THE ONE QUESTION THAT MATTERS MOST', 68, y + 8);
doc.font('Helvetica').fontSize(10.5).fillColor(DARK)
   .text('"If you had this product tomorrow, how would you get the first 10 law firms using it?"', 68, y + 23, { width: W - 138 });
y += 60;

// ── THE 6 QUESTIONS ────────────────────────────────────────────────────────
const questions = [
  {
    num: '1',
    q:   '"What\'s the first thing you think we\'re not seeing?"',
    note: 'Show the demo first. Then ask. Highest-value question in the conversation.',
    why: 'WHAT WE\'RE MISSING',
    color: INDIGO,
  },
  {
    num: '2',
    q:   '"If you were still talking to attorneys every day — what makes them lean in? What makes them tune out?"',
    note: 'This gets to positioning. His answer should reshape how Tad and Victoria describe the product.',
    why: 'HOW FIRMS THINK',
    color: INDIGO,
  },
  {
    num: '3',
    q:   '"Who inside the firm would feel this pain most — and want to solve it first?"',
    note: 'Don\'t assume Managing Partner. Could be Intake Director, Ops Manager, Legal Admin, Intake Team Lead. Who actually owns this problem?',
    why: 'WHO BUYS',
    color: PURPLE,
  },
  {
    num: '4',
    q:   '"If you had to explain one3Seven to a lawyer in one sentence, what would you say?"',
    note: 'His answer is probably better than ours. Write it down exactly. This may become the product tagline.',
    why: 'THEIR LANGUAGE',
    color: PURPLE,
  },
  {
    num: '5',
    q:   '"What would stop a firm from using this?"',
    note: 'Trust / liability / workflow change / cost / adoption / staff resistance. Whatever he says becomes the objection-handling roadmap.',
    why: 'THE ROADBLOCKS',
    color: AMBER,
  },
  {
    num: '6',
    q:   '"Who are 3 people you think would give us honest feedback?"',
    note: 'Not "can you help us." Ask for names. Warm introductions are how startups move. This is the most important closing question.',
    why: 'THE NEXT DOOR',
    color: GREEN,
  },
];

const leftCol = 50;
const rightCol = 320;
const colW = 245;
const rowH = 78;

for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  const col = i % 2 === 0 ? leftCol : rightCol;
  if (i % 2 === 0 && i > 0) y += rowH + 6;
  const qy = i % 2 === 0 ? y : y;

  doc.rect(col, qy, colW, rowH).fill('#FAFBFF');
  doc.rect(col, qy, colW, rowH).stroke('#E7E1FF').lineWidth(0.75);
  doc.rect(col, qy, 3, rowH).fill(q.color);

  doc.font('Helvetica-Bold').fontSize(7).fillColor(q.color)
     .text(q.why, col + 10, qy + 8, { characterSpacing: 0.8 });
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
     .text(q.q, col + 10, qy + 19, { width: colW - 18 });

  const noteY = qy + 19 + doc.currentLineHeight() * Math.ceil(q.q.length / 38) + 4;
  doc.font('Helvetica').fontSize(8).fillColor(GRAY)
     .text(q.note, col + 10, noteY, { width: colW - 18 });
}

y += rowH + 14;

// ── DO NOT BOX ─────────────────────────────────────────────────────────────
doc.rect(50, y, W - 100, 44).fill('#FEF2F2');
doc.rect(50, y, 4, 44).fill('#DC2626');
doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#991B1B')
   .text('DO NOT TALK ABOUT:', 62, y + 9, { characterSpacing: 0.7 });
doc.font('Helvetica').fontSize(9).fillColor('#7F1D1D')
   .text(
     'AI models · Supabase architecture · extraction pipelines · prompts · development timeline · anything about how the watch was built.',
     62, y + 22, { width: W - 120 }
   );
y += 56;

// ── HOW TO USE JIMMY'S ANSWERS ────────────────────────────────────────────
doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY)
   .text('HOW TO USE WHAT HE SAYS:', 50, y, { characterSpacing: 0.7 });
y += 14;

const uses = [
  ['Q4 one-sentence answer',       '→ Update product copy, outreach PDF, and the first line of every demo'],
  ['Q3 who feels pain first',       '→ Update ICP — who Tad calls first, who Victoria demos to first'],
  ['Q5 what stops them',            '→ Becomes objection-handling section in the sales bible'],
  ['Q6 who next (3 names)',         '→ Tad\'s next 3 outreach targets, warm intro if Jimmy offers'],
  ['The one question answer',       '→ Rewrite the go-to-market plan if his answer differs from current plan'],
];

for (const [what, action] of uses) {
  doc.circle(57, y + 4, 2.5).fill(PURPLE);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(DARK)
     .text(what + ' ', 65, y, { continued: true });
  doc.font('Helvetica').fillColor(GRAY).text(action);
  y += 14;
}

// ── FOOTER ──────────────────────────────────────────────────────────────────
doc.rect(0, H - 30, W, 30).fill(INDIGO);
doc.font('Helvetica').fontSize(8.5).fillColor(WHITE)
   .text(
     'one3seven-beta.vercel.app  ·  Jimmy\'s value = 10 years of legal industry knowledge. Use it.',
     50, H - 19, { width: W - 100, align: 'center' }
   );

doc.end();
console.log('Jimmy prep PDF written to', OUT);
