/**
 * Education Film lessons — WORKER-FACING, PUBLIC surface.
 *
 * DOCTRINE (strictest tier — public surface): these scripts teach process and general rights.
 * They ORGANIZE and INFORM; they NEVER conclude, never say "you have a case", never estimate
 * value, never give legal advice. Every line is FIXED and vetted, then rendered to audio by the
 * same safe-by-design ElevenLabs pipeline as the intake voice (scripts/gen-voice.mjs). Because the
 * narration only ever speaks approved lines, the format itself is the compliance guardrail.
 *
 * A doctrine test (lessons.doctrine.test.ts) scans every script + slide against the banned
 * vocabulary. Counsel should still review worker-education scripts before heavy promotion.
 *
 * Audio: each beat's `key` maps to /voice/lessons/<key>.mp3 (rendered from lesson-voice-lines.json).
 */

export interface LessonBeat {
  key: string;
  kicker: string;
  /** Slide heading — plain HTML (a single <em> for emphasis is fine). */
  title: string;
  /** Slide body — plain HTML. */
  body: string;
  /** The exact spoken/caption line (verbatim with lesson-voice-lines.json). */
  script: string;
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
  title: 'How one3seven organizes your records — and what it will never do',
  blurb: 'A short, plain-language walkthrough of how your scattered pile becomes an organized record you own — and the hard line we never cross.',
  minutes: 3,
  audience: 'worker',
  beats: [
    {
      key: 'lesson1_01',
      kicker: 'Welcome',
      title: 'Something happened at work. Let’s get it <em>in order</em>.',
      body: 'You have pay stubs, a few texts, maybe an email or two — scattered across your phone and a drawer. one3seven helps you put them in order. Here’s how it works, and just as important, what it will never do.',
      script: 'Something happened at work, and it did not feel right. You have pay stubs, a few texts, maybe an email or two, scattered across your phone and a drawer somewhere. one3seven helps you put them in order. Let me show you how it works, and just as important, what it will never do.',
    },
    {
      key: 'lesson1_02',
      kicker: 'Step one',
      title: 'You tell your story, <em>your</em> way.',
      body: 'In your own words — nothing fancy, no legal terms. You can even listen to each question read out loud if that’s easier.',
      script: 'Step one. You tell us what happened, in your own words. Nothing fancy, no legal terms. And if reading is hard, you can listen to each question out loud.',
    },
    {
      key: 'lesson1_03',
      kicker: 'Step two',
      title: 'You add what you <em>have</em>.',
      body: 'A photo of a pay stub. A screenshot of a text. An email. one3seven reads them and sorts them by date — you don’t have to organize anything yourself.',
      script: 'Step two. You add what you have. A photo of a pay stub, a screenshot of a text, an email. one3seven reads them and sorts them by date. You do not have to organize anything yourself.',
    },
    {
      key: 'lesson1_04',
      kicker: 'What you get',
      title: 'A clear timeline — every item traceable.',
      body: 'Your scattered pile becomes an organized timeline, and every item links back to the original document it came from. That’s a record, not a mess.',
      script: 'Here is what you get. Your scattered pile becomes an organized timeline, and every item links back to the original document it came from. That is a record, not a mess.',
    },
    {
      key: 'lesson1_05',
      kicker: 'It’s yours',
      title: 'This record <em>belongs to you</em>.',
      body: 'It’s free. You can download it, keep it, and share it with any attorney you choose. And if a firm passes, you don’t lose a thing — it’s still yours to take to the next one.',
      script: 'And this record belongs to you. It is free. You can download it, keep it, and share it with any attorney you choose. If a firm passes, you do not lose a thing. It is still yours, ready for the next one.',
    },
    {
      key: 'lesson1_06',
      kicker: 'The hard line',
      title: 'What one3seven will <em>never</em> do.',
      body: 'It will never decide whether your situation is a claim. It will never guess what a claim is worth. It doesn’t give legal advice. It organizes and it informs — the legal judgment stays with you and the attorney you choose.',
      script: 'Now here is the hard line. one3seven will never decide whether your situation is a claim. It will never guess what a claim is worth. It does not give legal advice. It organizes, and it informs. The legal judgment stays with you and the attorney you choose.',
    },
    {
      key: 'lesson1_07',
      kicker: 'Why that matters',
      title: 'Facts a lawyer can <em>trust</em>.',
      body: 'That line is on purpose. An organized record of facts is something a lawyer can review quickly and rely on. A guess from a computer is something they’d have to set aside. We keep it to the facts so your record is worth something.',
      script: 'That line is on purpose. An organized record of facts is something a lawyer can review quickly and rely on. A guess from a computer is something they would have to set aside. We keep it to the facts, so your record is actually worth something.',
    },
    {
      key: 'lesson1_08',
      kicker: 'Your first step',
      title: 'Start with your own records.',
      body: 'California lets you request your own pay records and personnel file. one3seven writes the request; you send it. Getting your records in order is the first step — start whenever you’re ready.',
      script: 'One more thing. California lets you request your own pay records and personnel file. one3seven writes the request, and you send it. Getting your records in order is the first step. Start whenever you are ready.',
    },
  ],
};

export const LESSONS: Lesson[] = [WORKER_RECORDS_LESSON];
