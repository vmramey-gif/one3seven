import { describe, expect, it } from 'vitest';
import { formatWorkerIntakeLastActivity } from '../workerDashboardFormat';

/** Mirrors LandingScreen list dedupe when an active intake card is shown above. */
function intakeCardsForList(
  cards: Array<{ intakeId: string }>,
  activeIntakeId: string | null | undefined
) {
  return activeIntakeId != null
    ? cards.filter((c) => c.intakeId !== activeIntakeId)
    : cards;
}

describe('worker dashboard progressive disclosure helpers', () => {
  it('excludes the active intake from the list to prevent duplicate cards', () => {
    const cards = [
      { intakeId: 'a' },
      { intakeId: 'b' },
    ];
    expect(intakeCardsForList(cards, 'a')).toEqual([{ intakeId: 'b' }]);
    expect(intakeCardsForList(cards, null)).toHaveLength(2);
  });

  it('formats last activity for compact intake rows', () => {
    const today = new Date().toISOString();
    expect(formatWorkerIntakeLastActivity(today)).toBe('Updated today');
    expect(formatWorkerIntakeLastActivity('')).toBeNull();
  });
});
