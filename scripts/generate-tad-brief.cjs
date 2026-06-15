const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'one3seven-tad-brief.pdf');
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
const RED    = '#DC2626';
const LILAC  = '#A5B4FC';

// ── SHARED LAYOUT HELPERS ────────────────────────────────────────────────────
function pageHeader(sub, pageNum, total) {
  doc.rect(0, 0, W, 68).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(17).fillColor(WHITE).text('one3Seven', ML, 16);
  doc.font('Helvetica').fontSize(9).fillColor(LILAC).text('Tad Talking Brief  ·  ' + sub, ML, 40);
  doc.rect(W - 86, 18, 36, 18).fill(PURPLE);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(WHITE)
     .text(`${pageNum}/${total}`, W - 86, 23, { width: 36, align: 'center' });
}

function pageFooter(label) {
  doc.rect(0, H - 26, W, 26).fill(INDIGO);
  doc.font('Helvetica').fontSize(8).fillColor(WHITE)
     .text('one3Seven  ·  Internal Working Document  ·  ' + label, ML, H - 17, { width: TW, align: 'center' });
}

function sectionLabel(text, y) {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(INDIGO)
     .text(text, ML, y, { characterSpacing: 1.1 });
  doc.moveTo(ML, y + 12).lineTo(W - ML, y + 12).strokeColor(LIGHT).lineWidth(0.75).stroke();
  return y + 20;
}

function sectionNum(num, title, y) {
  doc.rect(ML, y, 24, 24).fill(PURPLE);
  doc.font('Helvetica-Bold').fontSize(11).fillColor(WHITE).text(num, ML, y + 6, { width: 24, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(13).fillColor(NAVY).text(title, ML + 32, y + 5, { width: TW - 32 });
  return y + 32;
}

function body(text, y, opts = {}) {
  doc.font('Helvetica').fontSize(10).fillColor('#374151')
     .text(text, ML, y, { width: TW, lineGap: 2.5, ...opts });
  return y + doc.heightOfString(text, { width: TW, lineGap: 2.5, ...opts }) + 9;
}

function quoteCard(text, y, color) {
  color = color || PURPLE;
  const innerW = TW - 32;
  const h = doc.heightOfString(text, { width: innerW, lineGap: 2.5 }) + 24;
  doc.rect(ML, y, TW, h).fill(LIGHT);
  doc.rect(ML, y, 4, h).fill(color);
  doc.font('Helvetica-Bold').fontSize(10.5).fillColor(NAVY)
     .text(text, ML + 16, y + 12, { width: innerW, lineGap: 2.5 });
  return y + h + 12;
}

function bullet(text, y, color) {
  color = color || PURPLE;
  doc.circle(ML + 7, y + 5, 2.5).fill(color);
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
     .text(text, ML + 18, y, { width: TW - 18, lineGap: 2 });
  return y + doc.heightOfString(text, { width: TW - 18, lineGap: 2 }) + 7;
}

function numberedItem(num, text, y) {
  doc.rect(ML, y, 18, 18).fill(LIGHT);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(PURPLE).text(String(num), ML, y + 4, { width: 18, align: 'center' });
  doc.font('Helvetica').fontSize(9.5).fillColor(DARK)
     .text(text, ML + 24, y + 2, { width: TW - 24, lineGap: 2 });
  const h = doc.heightOfString(text, { width: TW - 24, lineGap: 2 });
  return y + Math.max(20, h + 6) + 4;
}

// ═════════════════════════════════════════════════════════════════════════════
// PAGE 1 — COVER + PURPOSE + OPENING
// ═════════════════════════════════════════════════════════════════════════════
doc.rect(0, 0, W, 310).fill(NAVY);

doc.font('Helvetica-Bold').fontSize(36).fillColor(WHITE).text('Tad Talking Brief', ML, 56, { width: TW, align: 'center' });
doc.font('Helvetica').fontSize(12).fillColor(LILAC)
   .text('one3Seven conversation with Jimmy / legal-tech contact', ML, 106, { width: TW, align: 'center' });
doc.moveTo(W / 2 - 24, 134).lineTo(W / 2 + 24, 134).strokeColor(PURPLE).lineWidth(2).stroke();
doc.font('Helvetica').fontSize(10).fillColor('#818CF8')
   .text('Use this as the meeting spine.  The goal is truth, not praise.', ML, 148, { width: TW, align: 'center' });

// floating card
doc.rect(ML, 218, TW, 64).fill(WHITE).stroke(BORDER);
doc.rect(ML, 218, 4, 64).fill(PURPLE);
doc.font('Helvetica-Bold').fontSize(11.5).fillColor(NAVY)
   .text('one3Seven is no longer only in the "can we build it?" stage.', ML + 16, 229, { width: TW - 32 });
doc.font('Helvetica').fontSize(10.5).fillColor(PURPLE)
   .text('It is entering the "will firms actually adopt it?" stage.', ML + 16, 250, { width: TW - 32 });
doc.font('Helvetica').fontSize(9).fillColor(GRAY)
   .text('That is the question this conversation should help answer.', ML + 16, 270, { width: TW - 32 });

let y = 318;

// Section 1
y = sectionNum('1', 'Purpose of the Conversation', y + 10);
y = body('This conversation is not about getting compliments. The purpose is to find out whether one3Seven has real adoption potential with law firms, what would make firms hesitate, and what must be true before someone like Jimmy would feel comfortable introducing it to a law firm contact.', y);

y += 8;
// Section 2
y = sectionNum('2', 'Opening Line', y);
y = quoteCard('"Victoria has built an early beta of one3Seven. It helps workers organize employment-related records, timelines, and intake information into a cleaner review packet for law firms. It does not give legal advice. It is meant to help firms review messy intake faster."', y, PURPLE);
doc.font('Helvetica').fontSize(9.5).fillColor(GRAY).text('Then say:', ML, y);
y += 16;
y = quoteCard('"We are not looking for compliments. We are trying to figure out where this would succeed, where it would fail, and what firms would actually need before they trusted or adopted it."', y, INDIGO);

y += 6;
// Section 3
y = sectionNum('3', 'Simple Explanation of one3Seven', y);

// Before / After card
const halfW = TW / 2 - 6;
const cardH = 74;
doc.rect(ML, y, halfW, cardH).fill('#FEF2F2').stroke('#FECACA').lineWidth(0.5);
doc.rect(ML, y, 4, cardH).fill(RED);
doc.font('Helvetica-Bold').fontSize(8).fillColor(RED).text('BEFORE', ML + 12, y + 9, { characterSpacing: 0.8 });
doc.font('Helvetica').fontSize(9).fillColor(DARK)
   .text('"I have texts, paystubs, HR complaints, write-ups, schedules, termination documents, screenshots, and a confusing story."', ML + 12, y + 23, { width: halfW - 20, lineGap: 2 });

const rx = ML + halfW + 12;
doc.rect(rx, y, halfW, cardH).fill('#F0FDF4').stroke('#BBF7D0').lineWidth(0.5);
doc.rect(rx, y, 4, cardH).fill(GREEN);
doc.font('Helvetica-Bold').fontSize(8).fillColor(GREEN).text('AFTER', rx + 12, y + 9, { characterSpacing: 0.8 });
doc.font('Helvetica').fontSize(9).fillColor(DARK)
   .text('"A structured intake packet with a timeline, records, current understanding, missing information, and a cleaner firm-side review experience."', rx + 12, y + 23, { width: halfW - 20, lineGap: 2 });
y += cardH + 12;

doc.font('Helvetica').fontSize(9.5).fillColor(GRAY)
   .text('The goal is not to replace an attorney. The goal is to help firms get to a better first review faster.', ML, y, { width: TW });
y += 20;

pageFooter('Jimmy Meeting Prep');

// ═════════════════════════════════════════════════════════════════════════════
// PAGE 2 — THE 3 QUESTIONS
// ═════════════════════════════════════════════════════════════════════════════
doc.addPage();
pageHeader('The 3 Most Important Questions', 2, 4);
y = 84;

y = sectionNum('4', 'The 3 Most Important Questions to Ask Jimmy', y);

// Q1
doc.rect(ML, y, TW, 22).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE).text('Question 1 — Tell me where this dies.', ML + 12, y + 6);
y += 22;
y = quoteCard('"If this fails, why does it fail?"', y, RED);
y = body('Do not ask only where it works. Ask where it breaks. Listen for:', y);

const failReasons = [
  'Attorneys will not trust it.',
  'Intake staff will not change workflow.',
  'Firms will not pay.',
  'Adoption friction is too high.',
  'Firms already think they have a process.',
  'The AI language makes firms nervous.',
  'The value is not obvious fast enough.',
  'It creates more work instead of saving time.',
];
for (const r of failReasons) y = bullet(r, y, RED);
doc.font('Helvetica-Bold').fontSize(9.5).fillColor(DARK)
   .text('This answer is more valuable than compliments.', ML, y);
y += 22;

// Q2
doc.rect(ML, y, TW, 22).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE).text('Question 2 — Who feels this pain most?', ML + 12, y + 6);
y += 22;
y = quoteCard('"Which exact person inside a firm wakes up every day hating the intake process?"', y, PURPLE);
y = body('Possible answers: intake manager, firm owner, managing attorney, legal administrator, case manager, marketing director, referral coordinator, or plaintiff-side operations person.', y);
y = body('The person who feels the pain most may not be the same person who writes the check, but they influence the buying decision. We need to know who actually owns the problem.', y);
y += 8;

// Q3
doc.rect(ML, y, TW, 22).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(10).fillColor(WHITE).text('Question 3 — What would make you introduce this to someone?', ML + 12, y + 6);
y += 22;
y = quoteCard('"What would need to be true for you to confidently introduce us to a law firm friend?"', y, INDIGO);
y = body('This is the trust-gap question. His answer may reveal what is missing before the product is introduction-ready. He may say the demo needs to be tighter, the language needs to sound less like AI, security needs to be explained better, or the firm-side value needs to be clearer.', y);
y += 10;

// Company Obsession
y = sectionNum('5', 'The Company Obsession Question', y);
y = quoteCard('"Why should this firm care?"', y, PURPLE);
y = body('Every screen should answer that. Every demo should answer that. Every sales conversation should answer that.', y);
y = body('If a firm does not quickly understand why one3Seven helps them, the product will feel interesting but not urgent.', y);

pageFooter('Jimmy Meeting Prep');

// ═════════════════════════════════════════════════════════════════════════════
// PAGE 3 — WHAT TO LEARN + LISTEN FOR + NOT OVER-EXPLAIN
// ═════════════════════════════════════════════════════════════════════════════
doc.addPage();
pageHeader('What to Learn · What to Listen For', 3, 4);
y = 84;

y = sectionNum('6', 'What We Need to Learn From Jimmy', y);
const learnItems = [
  'Does this solve a real intake problem from what you have seen?',
  'Who inside a firm would care most about this?',
  'Who would block this?',
  'Would this be viewed as legal tech, lead qualification, intake operations, or referral infrastructure?',
  'What part of the demo feels strongest?',
  'What part feels unclear?',
  'What would an attorney distrust?',
  'What would make a firm say yes to testing this?',
  'What would make a firm ignore it?',
  'Who should we show this to next?',
];
for (let i = 0; i < learnItems.length; i++) y = numberedItem(i + 1, learnItems[i], y);

y += 10;
y = sectionNum('7', 'What Tad Should Listen For', y);

const colW = TW / 2 - 8;

// Good signs card
doc.rect(ML, y, colW, 146).fill('#F0FDF4').stroke('#BBF7D0').lineWidth(0.5);
doc.rect(ML, y, 4, 146).fill(GREEN);
doc.font('Helvetica-Bold').fontSize(9).fillColor(GREEN).text('GOOD SIGNS', ML + 12, y + 10, { characterSpacing: 0.7 });
let gy = y + 26;
for (const s of [
  'Jimmy understands the problem quickly.',
  'He starts naming specific firm roles.',
  'He compares it to real intake issues.',
  'He asks about pricing, security, or testing.',
  'He suggests a specific person to show.',
  'He says intake teams would care if it saves time.',
]) {
  doc.circle(ML + 18, gy + 4, 2).fill(GREEN);
  doc.font('Helvetica').fontSize(9).fillColor(DARK).text(s, ML + 26, gy, { width: colW - 34 });
  gy += 17;
}

// Warning signs card
const wx = ML + colW + 16;
doc.rect(wx, y, colW, 146).fill('#FEF2F2').stroke('#FECACA').lineWidth(0.5);
doc.rect(wx, y, 4, 146).fill(RED);
doc.font('Helvetica-Bold').fontSize(9).fillColor(RED).text('WARNING SIGNS', wx + 12, y + 10, { characterSpacing: 0.7 });
let wy2 = y + 26;
for (const s of [
  'Interesting but cannot name who would use it.',
  'Does not understand who pays.',
  'Thinks firms will see it as a lead tool.',
  'Thinks attorneys will distrust the AI.',
  'Thinks staff will resist workflow change.',
  'Thinks the demo takes too long to explain.',
  'Cannot imagine introducing it yet.',
]) {
  doc.circle(wx + 18, wy2 + 4, 2).fill(RED);
  doc.font('Helvetica').fontSize(9).fillColor(DARK).text(s, wx + 26, wy2, { width: colW - 34 });
  wy2 += 17;
}
y += 158;

y = sectionNum('8', 'What Not to Over-Explain', y);
y = body('Do not spend too much time on: the full tech stack, every bug fixed, every future feature, the entire founder story, fundraising, valuation, long-term litigation support ideas, big market claims, or AI hype.', y);
y = quoteCard('"Keep the conversation focused on firm adoption: would a real firm care enough to use this?"', y, AMBER);

pageFooter('Jimmy Meeting Prep');

// ═════════════════════════════════════════════════════════════════════════════
// PAGE 4 — DISCIPLINE + FRAMING + CLOSING + IDEAL OUTCOME
// ═════════════════════════════════════════════════════════════════════════════
doc.addPage();
pageHeader('60-Day Discipline · Closing · Ideal Outcome', 4, 4);
y = 84;

y = sectionNum('9', '60-Day Discipline', y);
y = body('For the next 60 days, no feature should be built unless it improves one of these:', y);

// 4 discipline pills
const pillW = (TW - 18) / 4;
for (const [label, color] of [
  ['Firm trust', PURPLE],
  ['Firm adoption', INDIGO],
  ['Review speed', GREEN],
  ['Firm conversion', AMBER],
]) {
  const px = ML + ['Firm trust', 'Firm adoption', 'Review speed', 'Firm conversion'].indexOf(label) * (pillW + 6);
  doc.rect(px, y, pillW, 30).fill(NAVY);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(color).text(label, px + 4, y + 10, { width: pillW - 8, align: 'center' });
}
y += 42;
y = body('Everything else goes into the future roadmap. If a feature does not help a firm trust the product, adopt the product, review faster, or convert more useful intakes, it is not the priority right now.', y);

y += 8;
y = sectionNum('10', 'Best Way to Frame the Current Stage', y);
y = quoteCard('"We are not pretending this is finished enterprise software yet. The core product is built enough to show and test. Now the big question is whether firms actually adopt it, what they need to trust it, and what would make them pay attention."', y, INDIGO);
doc.font('Helvetica').fontSize(9.5).fillColor(GRAY).text('This makes us sound honest, serious, and self-aware.', ML, y);
y += 22;

y = sectionNum('11', 'Strong Closing Question', y);
y = quoteCard('"Based on what you saw today, what would you tell us to fix, prove, or explain before we put this in front of a real law firm?"', y, GREEN);
doc.font('Helvetica-Bold').fontSize(9.5).fillColor(NAVY)
   .text('Then stop talking and let Jimmy answer.', ML, y);
y += 26;

y = sectionNum('12', 'Ideal Outcome', y);
y = body('A successful meeting does not mean Jimmy says "This is amazing." A successful meeting means we learn where one3Seven might fail, who feels the intake pain most, what firms would distrust, what part of the demo works, what part needs cleanup, what would make Jimmy comfortable introducing it, and who we should speak with next.', y);

// Final card
doc.rect(ML, y, TW, 58).fill(NAVY);
doc.font('Helvetica-Bold').fontSize(13).fillColor(WHITE)
   .text('"The goal is truth."', ML + 16, y + 10, { width: TW - 32 });
doc.font('Helvetica').fontSize(10.5).fillColor(LILAC)
   .text('Truth helps us build the next version correctly.', ML + 16, y + 32, { width: TW - 32 });
y += 70;

pageFooter('Jimmy Meeting Prep');

doc.end();
console.log('Tad brief PDF written to', OUT);
