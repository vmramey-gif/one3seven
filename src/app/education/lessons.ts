/**
 * Education Film lessons — narrated, in-app films.
 *
 * TWO AUDIENCES:
 *   - WORKER (public surface, strictest tier): teaches process and general rights. ORGANIZES and
 *     INFORMS; NEVER concludes, never says "you have a case", never estimates a claim's value, never
 *     gives legal advice. The tone is allowed to be bold and emotional — the guardrail is the
 *     vocabulary, not the energy.
 *   - ATTORNEY/FIRM (business case): shows what one3seven replaces and what it saves — in minutes,
 *     throughput, and dollars. Business ROI figures (our price, the firm's own per-case underwriting
 *     cost) are legitimate here; they value the firm's cost and our price, NEVER a worker's claim.
 *
 * Every line is FIXED and vetted, then rendered to audio by the same safe-by-design ElevenLabs
 * pipeline as the intake voice (scripts/gen-voice.mjs). Because the narration only ever speaks
 * approved lines, the format itself is the compliance guardrail.
 *
 * A doctrine test (lessons.doctrine.test.ts) scans every script + slide against the banned
 * vocabulary (all lessons) and the no-merit/no-dollar rule (worker lessons only). Counsel should
 * still review scripts before heavy promotion.
 *
 * Audio: each beat's `key` maps to /voice/lessons/<key>.mp3 (rendered from lesson-voice-lines.json).
 */

/**
 * Optional on-screen visual for a beat. FIRM/ATTORNEY films use these to show the comparison
 * (standard vs the top AI intake tool vs one3seven) in bars and a feature matrix. Every number is
 * an illustrative, firm-editable assumption — labelled as such on screen, never a proven benchmark.
 */
export type BeatVisual =
  | {
      kind: 'bars';
      note?: string;
      rows: { label: string; sub?: string; value: string; pct: number; tone: 'base' | 'ai' | 'o3s' }[];
    }
  | {
      kind: 'matrix';
      cols: string[]; // column headers after the feature column; last col is one3seven
      rows: { feature: string; cells: { text: string; tone?: 'yes' | 'no' | 'part' | 'o3s' }[] }[];
    };

export interface LessonBeat {
  key: string;
  kicker: string;
  /** Slide heading — plain HTML (a single <em> for emphasis is fine). */
  title: string;
  /** Slide body — plain HTML. */
  body: string;
  /** The exact spoken/caption line (verbatim with lesson-voice-lines.json). */
  script: string;
  /** Optional comparison visual (bars / matrix) rendered above the body. */
  visual?: BeatVisual;
}

export interface Lesson {
  slug: string;
  title: string;
  blurb: string;
  minutes: number;
  audience: 'worker' | 'attorney';
  beats: LessonBeat[];
}

export const WORKER_RECORDS_LESSON: Lesson = {
  slug: 'organize-your-records',
  title: 'For the first time, the record is yours',
  blurb: 'You kept everything. one3seven turns the shoebox into one dated, provable record you own — free, forever. Here is why that changes who holds the cards.',
  minutes: 3,
  audience: 'worker',
  beats: [
    {
      key: 'lesson1_01',
      kicker: 'This is new',
      title: 'You kept everything. <em>Finally</em>, that matters.',
      body: 'The screenshots you never deleted. The pay stub in the junk drawer. The email you re-read at 2 a.m. Alone, it is a shoebox. In order, it becomes a record — and for the first time, one you own. Free. Yours. Nobody has built this for you before.',
      script: 'You kept everything. The screenshots you never deleted, the pay stub in the junk drawer, the email you re-read at two in the morning. Alone, it is a shoebox. Put in order, it becomes a record. And for the first time, that record is yours. Free, and yours to keep. No one has ever built this for you before. Let me show you.',
    },
    {
      key: 'lesson1_02',
      kicker: 'Step one',
      title: 'Say it once. In <em>plain words</em>.',
      body: 'No legal terms. No form that makes you feel small. You talk — or tap the screen to hear each question and answer out loud. Why it matters: you should never need a law degree just to be believed.',
      script: 'Here is how it starts. You say what happened, once, in plain words. No legal terms, no form that makes you feel small. You can read it, or press play and hear each question out loud, and answer out loud. Why does that matter? Because you should never need a law degree just to be believed.',
    },
    {
      key: 'lesson1_03',
      kicker: 'Step two',
      title: 'Throw it all in. It <em>organizes itself</em>.',
      body: 'A blurry photo of a paystub. A text from a coworker. A long email chain. one3seven reads each one and drops it onto a dated timeline — in seconds, in order. Why it matters: the part that used to feel impossible is the part you now skip.',
      script: 'Now the part that used to feel impossible. You throw in whatever you have. A blurry photo of a paystub, a text from a coworker, a long email chain. one3seven reads each one and places it on a dated timeline, in seconds, in the right order. You do none of the sorting. The hardest part becomes the part you skip.',
    },
    {
      key: 'lesson1_04',
      kicker: 'What you get',
      title: 'One clear story. Every line <em>provable</em>.',
      body: 'What comes back is a clean, dated timeline — and every entry links straight to the document it came from. Not your word against theirs. Your word, with the receipt attached to every line.',
      script: 'And here is what comes back. One clean, dated timeline of what happened, and every single line links straight to the document it came from. This is the difference that changes everything. It is no longer your word against theirs. It is your word, with the receipt attached to every line.',
    },
    {
      key: 'lesson1_05',
      kicker: 'The part that changes everything',
      title: 'You walk in <em>ready</em>. That is new.',
      body: 'It is free, and it is yours forever. Download it, keep it, hand it to any attorney you choose. If one says no, you lose nothing — you walk to the next one already organized. For the first time, you are not the one being screened. You are the one who came prepared.',
      script: 'This record is yours. Free, forever. Download it, keep it, hand it to any attorney you choose. And if one firm says no, you lose nothing. You walk to the next one already organized. Think about that. For the first time, you are not the one being screened. You are the one who showed up ready.',
    },
    {
      key: 'lesson1_06',
      kicker: 'One honest line',
      title: 'One line it will <em>never</em> cross.',
      body: 'It will never tell you whether your situation is a claim, never guess what anything is worth, never give legal advice. That restraint is the point — it is what keeps your record clean enough for a real lawyer to trust on sight.',
      script: 'One promise, and it is a line we will never cross. one3seven will never tell you whether your situation is a claim, never guess what anything is worth, and never give you legal advice. That restraint is not a weakness. It is exactly what keeps your record clean enough for a real lawyer to trust the moment they open it.',
    },
    {
      key: 'lesson1_07',
      kicker: 'Why it works',
      title: 'Facts a lawyer can move on <em>in minutes</em>.',
      body: 'A clean record of facts is something an attorney can read fast and rely on. A computer’s guess is something they are trained to throw out. We keep it to what is real and sourced — so your record carries weight the moment it lands on the desk.',
      script: 'And this is why the restraint works in your favor. A clean record of facts is something an attorney can read in minutes and rely on. A guess from a computer is something they are trained to throw out. So we keep it to what is real, and what is sourced. That is what makes your record carry weight the moment it lands on the desk.',
    },
    {
      key: 'lesson1_08',
      kicker: 'Your move',
      title: 'It starts with <em>your own records</em>.',
      body: 'California gives you the right to your own pay records and personnel file. one3seven writes the request — you send it. That is the first brick in the record you own. Lay it whenever you are ready. It is free.',
      script: 'So here is your move. California gives you the right to your own pay records and your personnel file. one3seven writes the request for you; you send it. That is the first brick in the record you own. Lay it whenever you are ready. It costs you nothing.',
    },
  ],
};

/**
 * FIRM / ATTORNEY film — the business case, not the worker journey. Shows exactly what one3seven
 * replaces and what it saves, side by side: the traditional cold read, the top AI intake tool, and
 * one3seven — in minutes, throughput, and dollars. The "organizes, never concludes" line appears
 * ONCE, at the end, as the reason the tool is safe — not the pitch. Every figure is an illustrative,
 * firm-editable assumption shown on screen — never a proven benchmark, and downstream leverage is
 * framed as removed rework, never a guaranteed faster outcome.
 */
export const FIRM_VALUE_LESSON: Lesson = {
  slug: 'what-one3seven-replaces',
  title: 'What one3seven replaces — and what it saves you',
  blurb: 'The intake cold read against the top AI tool and one3seven — in minutes, throughput, and dollars. What you get back is time, capacity, and the good cases that used to disappear under the pile.',
  minutes: 4,
  audience: 'attorney',
  beats: [
    {
      key: 'firm1_01',
      kicker: 'For the firm',
      title: 'Every intake bleeds <em>ninety minutes</em> before you say no.',
      body: 'A stranger walks in with a shoebox. Someone senior spends ninety minutes reconstructing it just to decide it is not a case. You cannot bill a minute of it. Multiply that by every intake you decline — that invisible pile is the real cost of screening.',
      script: 'Start with the number that hurts. Every intake you take starts the same way. A stranger walks in with a shoebox, and someone senior spends ninety minutes reconstructing it, just to decide whether it is even a case. You cannot bill a minute of that time. Now multiply it by every intake you decline. That invisible pile is the real cost of screening, and it is enormous.',
    },
    {
      key: 'firm1_02',
      kicker: 'Time per intake',
      title: 'Ninety minutes becomes <em>eighteen</em>.',
      body: 'Same intake, to a decision. The cold read: ninety minutes. A generic AI summary you still verify line by line: fifty-five. one3seven, opening a source-linked record with a coverage map already built: eighteen. Not a faster read — a different job.',
      script: 'Here is what changes. Same intake, same decision. The traditional cold read takes about ninety minutes. A generic A-I tool gives you a summary you still have to verify line by line, so call it fifty-five. one3seven opens a source-linked record with a coverage map already built, and you reach a decision in about eighteen. That is not a faster read. It is a different job.',
      visual: {
        kind: 'bars',
        note: 'Illustrative, firm-editable. Minutes to a screening decision on one new intake.',
        rows: [
          { label: 'Traditional', sub: 'cold read', value: '90 min', pct: 100, tone: 'base' },
          { label: 'Top AI intake', sub: 'summary, unverified', value: '55 min', pct: 61, tone: 'ai' },
          { label: 'one3seven', sub: 'source-linked + coverage', value: '18 min', pct: 20, tone: 'o3s' },
        ],
      },
    },
    {
      key: 'firm1_03',
      kicker: 'Throughput',
      title: 'The same ten hours clears <em>five times</em> the pile.',
      body: 'Ten hours a week on screening. The old way clears about seven intakes. A top AI tool, eleven. one3seven, thirty-three — five times traditional, three times the best tool, from hours you already spend.',
      script: 'Turn the minutes into capacity. Say you spend ten hours a week screening. The old way, that clears about seven intakes. A top A-I tool, about eleven. one3seven, about thirty-three. Five times the traditional pace, three times the best tool on the market, out of the exact same ten hours you already spend.',
      visual: {
        kind: 'bars',
        note: 'Illustrative. Intakes screened per 10-hour week.',
        rows: [
          { label: 'Traditional', value: '~7 / wk', pct: 21, tone: 'base' },
          { label: 'Top AI intake', value: '~11 / wk', pct: 33, tone: 'ai' },
          { label: 'one3seven', value: '~33 / wk', pct: 100, tone: 'o3s' },
        ],
      },
    },
    {
      key: 'firm1_04',
      kicker: 'The real cost',
      title: 'You are already an <em>underwriter</em> — by hand.',
      body: 'Ten to twenty hours of senior time per case: reading the file, running the wage math, drafting the demand. Industry-reported, that is $3,500 to $13,000 before a complaint is filed. And it lives in the 63% of the day you cannot bill.',
      script: 'And understand what that screening really is. You are already underwriting every case, by hand. Ten to twenty hours of senior time reading the file, running the wage math, drafting the demand. Industry-reported, that is thirty-five hundred to thirteen thousand dollars per case, before a single complaint is filed. And every hour of it lives in the sixty-three percent of the day you cannot bill.',
    },
    {
      key: 'firm1_05',
      kicker: 'What it costs',
      title: 'Priced against the waste — not against <em>software</em>.',
      body: 'one3seven is $375 per attorney a month; a five-lawyer firm, about $1,875. Catch one arbitration clause, spot one dead deadline, turn away one bad case — any single one pays for the year. This is underwriting infrastructure, not another subscription.',
      script: 'So we do not price like software. We price against the waste we remove. one3seven is three hundred seventy-five dollars per attorney a month. A five-lawyer firm, about nineteen hundred. Catch one arbitration clause, spot one dead deadline, turn away one bad case, and any single one of them pays for the entire year. This is underwriting infrastructure, not another subscription.',
    },
    {
      key: 'firm1_06',
      kicker: 'The full picture',
      title: 'Not a summary. A <em>review-ready file</em>.',
      body: 'A generic tool automates the form and hands you a summary you cannot trust. one3seven hands you source-linked facts, a Coverage Rate nobody else computes, a record the worker keeps current, and every line auditable to its page.',
      script: 'Here is the whole picture against the tool you already know. It automates the intake form and hands you a summary you cannot trust without re-reading it. one3seven hands you source-linked facts, a coverage rate no competitor computes, a record the worker keeps current on their own, and every line auditable back to the page it came from. One is a form. The other is a review-ready file.',
      visual: {
        kind: 'matrix',
        cols: ['Traditional', 'Top AI intake', 'one3seven'],
        rows: [
          { feature: 'Source-linked facts', cells: [{ text: '✗', tone: 'no' }, { text: 'partial', tone: 'part' }, { text: '✓', tone: 'o3s' }] },
          { feature: 'Coverage Rate metric', cells: [{ text: '✗', tone: 'no' }, { text: '✗', tone: 'no' }, { text: '✓', tone: 'o3s' }] },
          { feature: 'Fact-check speed', cells: [{ text: 'slow', tone: 'no' }, { text: 'medium', tone: 'part' }, { text: 'one-click', tone: 'o3s' }] },
          { feature: 'Worker keeps the record', cells: [{ text: '✗', tone: 'no' }, { text: '✗', tone: 'no' }, { text: '✓', tone: 'o3s' }] },
          { feature: 'Reused downstream', cells: [{ text: '✗', tone: 'no' }, { text: '✗', tone: 'no' }, { text: '✓', tone: 'o3s' }] },
          { feature: 'Auditable to the source', cells: [{ text: '—', tone: 'no' }, { text: 'partial', tone: 'part' }, { text: '✓', tone: 'o3s' }] },
        ],
      },
    },
    {
      key: 'firm1_07',
      kicker: 'It compounds',
      title: 'Screen it once. It <em>works the whole case</em>.',
      body: 'The source-linked record that screens the case in eighteen minutes is the same spine under the demand letter and the mediation brief. Not a promise of a faster verdict — the rework between stages simply disappears.',
      script: 'And it does not stop at the front door. The same source-linked record that screens the case in eighteen minutes becomes the spine of the demand letter, and then the mediation brief. We are not promising you a faster verdict. We are deleting the rework between every stage, so the hours you spend once keep paying you back.',
    },
    {
      key: 'firm1_08',
      kicker: 'The bottom line',
      title: 'Faster screens. Cleaner files. <em>The cases you were missing.</em>',
      body: 'You get back time, capacity, and a stronger file on every matter — plus the good cases that used to disappear under the pile. And one3seven never touches the judgment: it organizes and cites; the decision stays yours.',
      script: 'So here is the bottom line. Faster screens, cleaner files, and the good cases that used to disappear under the pile. You get back time, capacity, and a stronger file on every matter you take. And one3seven never touches the judgment. It organizes and it cites. The decision stays exactly where it belongs. With you.',
    },
  ],
};

export const LESSONS: Lesson[] = [WORKER_RECORDS_LESSON, FIRM_VALUE_LESSON];
