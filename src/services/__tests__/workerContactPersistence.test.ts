import { describe, it, expect } from 'vitest';
import {
  extractWorkerContactFromOverview,
  stripWorkerContactBlock,
} from '../workerContactPersistence';
import { sanitizeFirmFacingText } from '../intakeDataService';

const OVERVIEW_WITH_CONTACT =
  'Organized employment timeline for review.\n' +
  '--- O3S_WORKER_CONTACT ---\n' +
  'name:Marcus Reyes\n' +
  'phone:(555) 213-8890\n' +
  '--- O3S_WORKER_CONTACT_END ---';

describe('workerContactPersistence', () => {
  it('extracts name and phone from the overview block', () => {
    expect(extractWorkerContactFromOverview(OVERVIEW_WITH_CONTACT)).toEqual({
      name: 'Marcus Reyes',
      phone: '(555) 213-8890',
    });
  });

  it('returns null when no contact block is present', () => {
    expect(extractWorkerContactFromOverview('Just a plain overview.')).toBeNull();
    expect(extractWorkerContactFromOverview('')).toBeNull();
    expect(extractWorkerContactFromOverview(null)).toBeNull();
  });

  it('extracts a partial block (name only, no phone)', () => {
    const nameOnly =
      '--- O3S_WORKER_CONTACT ---\nname:Jordan Lee\n--- O3S_WORKER_CONTACT_END ---';
    expect(extractWorkerContactFromOverview(nameOnly)).toEqual({ name: 'Jordan Lee', phone: null });
  });

  it('stripWorkerContactBlock removes the raw block', () => {
    const stripped = stripWorkerContactBlock(OVERVIEW_WITH_CONTACT);
    expect(stripped).not.toContain('O3S_WORKER_CONTACT');
    expect(stripped).not.toContain('Marcus Reyes');
    expect(stripped).toContain('Organized employment timeline for review.');
  });

  it('PRIVACY: the contact block never survives into firm-facing prose', () => {
    const firmFacing = sanitizeFirmFacingText(OVERVIEW_WITH_CONTACT);
    expect(firmFacing).not.toContain('O3S_WORKER_CONTACT');
    expect(firmFacing).not.toContain('555) 213-8890');
    expect(firmFacing).not.toContain('phone:');
    // The legitimate prose remains.
    expect(firmFacing).toContain('Organized employment timeline for review.');
  });
});
