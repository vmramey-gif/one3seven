import { describe, expect, test } from 'vitest';
import { buildDocumentGroundedOrganization } from '../documentGroundedOrganizationService';
import {
  DATE_UNCLEAR_LABEL,
  bestEmploymentChronologyAnchor,
  classifiedDatesByCategory,
  extractClassifiedDates,
  uniqueSortedEmploymentChronologyDates,
} from '../contextualDateClassification';

const OFFER_LETTER_FIXTURE = `
OFFER LETTER
Date: August 16, 2023

This offer is conditioned on compliance with the Immigration Reform and Control Act of 1986.
Reference to the Act of 1986 is for legal background only.
`;

function assertNo1986InEmploymentOutputs(org: NonNullable<ReturnType<typeof buildDocumentGroundedOrganization>>) {
  expect(org.timelineEvents.some((e) => /\b1986\b/.test(e.eventDate))).toBe(false);
  expect(org.timelineEvents.some((e) => /\b1986\b/.test(e.aiSummary))).toBe(false);
  expect(/\b1986\b/.test(org.timelineSummary)).toBe(false);
  expect(/\b1986\b/.test(org.overview)).toBe(false);
}

describe('contextual date classification', () => {
  test('classifies Immigration Reform Act of 1986 as legal reference', () => {
    const corpus = 'Immigration Reform and Control Act of 1986';
    const hits = extractClassifiedDates(corpus);
    const y1986 = hits.filter((h) => h.token === '1986');
    expect(y1986.length).toBeGreaterThan(0);
    expect(y1986.every((h) => h.category === 'legal_reference')).toBe(true);
    expect(uniqueSortedEmploymentChronologyDates(corpus)).toEqual([]);
  });

  test('classifies DOB slash date as birth/personal only', () => {
    const corpus = 'Employee information\nDOB: 04/12/1986\nHire date: March 1, 2020';
    const byCat = classifiedDatesByCategory(corpus);
    expect(byCat.birth_personal.some((t) => t.includes('1986'))).toBe(true);
    expect(byCat.employment_chronology.some((t) => t.includes('1986'))).toBe(false);
    expect(byCat.employment_chronology.some((t) => /2020/.test(t))).toBe(true);
  });

  test('detects month-year pay period dates without inventing exact days', () => {
    const corpus = 'Pay period March 2024 gross pay $2400 overtime 4 hours';
    expect(uniqueSortedEmploymentChronologyDates(corpus)).toContain('March 2024');
    expect(bestEmploymentChronologyAnchor(corpus)).toBe('March 2024');
  });

  test('detects month-year termination dates', () => {
    const corpus = 'Termination date April 2025 final pay and separation paperwork';
    expect(uniqueSortedEmploymentChronologyDates(corpus)).toContain('April 2025');
    expect(bestEmploymentChronologyAnchor(corpus)).toBe('April 2025');
  });

  test('detects employment date spans with full and abbreviated month-year tokens', () => {
    const corpus = 'Employment dates April 2004 through Apr 2025';
    const employment = uniqueSortedEmploymentChronologyDates(corpus);
    expect(employment).toContain('April 2004');
    expect(employment).toContain('Apr 2025');
    expect(employment.some((d) => /\b\d{1,2},/.test(d))).toBe(false);
  });

  test('Civil Code section does not produce employment chronology year', () => {
    const corpus = 'Tenant rights under Civil Code §1950.5 regarding security deposits.';
    const employment = uniqueSortedEmploymentChronologyDates(corpus);
    expect(employment.some((d) => d.includes('1950'))).toBe(false);
    expect(bestEmploymentChronologyAnchor(corpus)).toBe(DATE_UNCLEAR_LABEL);
  });

  test('offer letter: August 16, 2023 anchor; 1986 excluded from employment outputs', () => {
    const org = buildDocumentGroundedOrganization(
      [{ fileName: 'Offer_Letter.pdf', category: 'Offer Letters', uploadedFileId: 'file-1' }],
      [
        {
          uploadedFileId: 'file-1',
          fileName: 'Offer_Letter.pdf',
          category: 'Offer Letters',
          extractedText: OFFER_LETTER_FIXTURE,
          qualityFlags: null,
        },
      ],
      null
    );

    expect(org).not.toBeNull();
    if (!org) return;

    assertNo1986InEmploymentOutputs(org);
    expect(org.timelineSummary).toContain('August 16, 2023');
    expect(org.timelineEvents[0]?.eventDate).toBe('August 16, 2023');

    const meta = classifiedDatesByCategory(OFFER_LETTER_FIXTURE);
    expect(meta.legal_reference).toContain('1986');
    expect(meta.employment_chronology).toContain('August 16, 2023');
  });

  test('standalone year without employment context is not employment chronology', () => {
    const corpus = 'A footnote mentions the year 1986 in passing with no employment meaning.';
    expect(uniqueSortedEmploymentChronologyDates(corpus)).toEqual([]);
    const hits = extractClassifiedDates(corpus);
    const y = hits.find((h) => h.token === '1986');
    expect(y?.category).not.toBe('employment_chronology');
  });
});
