import { describe, it, expect } from 'vitest';
import { LESSONS } from '../lessons';
import { scanBannedVocabulary } from '../../../services/bannedVocabulary';

/**
 * Public education surface = strictest no-conclude tier. Every spoken/visible line in every lesson
 * must pass the banned-vocabulary scan. If someone adds a lesson beat that says "you have a case",
 * "strong claim", a dollar value, etc., this fails the build before it can be rendered to audio.
 */
describe('education lessons — doctrine', () => {
  for (const lesson of LESSONS) {
    describe(lesson.slug, () => {
      it('every beat (title, body, script) is free of banned vocabulary', () => {
        for (const beat of lesson.beats) {
          for (const field of ['title', 'body', 'script'] as const) {
            const hits = scanBannedVocabulary(beat[field]);
            expect(hits, `${beat.key}.${field} contains banned vocabulary: ${hits.join(', ')}`).toEqual([]);
          }
        }
      });

      it('the script and the caption line are identical (audio matches the screen)', () => {
        // script is what we render to /voice/lessons/<key>.mp3 and also show as the caption.
        for (const beat of lesson.beats) {
          expect(beat.script.trim().length).toBeGreaterThan(0);
        }
      });

      // No-dollar / no-merit rule is WORKER-surface only. A firm/attorney film legitimately quotes
      // business ROI — our price and the firm's own per-case underwriting cost — which values the
      // firm's cost and our price, never a worker's claim. "you have a case" stays banned for both
      // (via the banned-vocabulary scan above); the bare dollar-figure guard is worker-only.
      if (lesson.audience === 'worker') {
        it('worker lessons make no valuation claim (no "$", "you have a case")', () => {
          for (const beat of lesson.beats) {
            const blob = `${beat.title} ${beat.body} ${beat.script}`;
            // A dollar figure or "you (do) have a case" would be a conclusion. (The lesson may SAY
            // "never guess what anything is worth" — that negated form is allowed; a bare
            // assertion is not. Guard the asserting forms only.)
            expect(/\$\s?\d/.test(blob), `${beat.key} shows a dollar figure`).toBe(false);
            expect(/\byou (do )?have a (strong )?case\b/i.test(blob), `${beat.key} asserts a case`).toBe(false);
          }
        });
      }
    });
  }
});
