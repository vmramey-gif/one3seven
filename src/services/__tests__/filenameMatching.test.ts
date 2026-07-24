import { describe, expect, test } from 'vitest';
import { normalizeFilenameForMatching } from '../filenameMatching';
import { inferCategoryFromFileName } from '../intakeDataService';

describe('normalizeFilenameForMatching', () => {
  test('splits CamelCase into space-delimited words', () => {
    expect(normalizeFilenameForMatching('WrittenWarning')).toBe('written warning');
    expect(normalizeFilenameForMatching('OfferLetter2022.pdf')).toBe('offer letter2022 pdf');
    expect(normalizeFilenameForMatching('PayStubFeb.pdf')).toBe('pay stub feb pdf');
  });

  test('collapses underscores, hyphens, dots and spaces to a single space', () => {
    expect(normalizeFilenameForMatching('Rosa_WrittenWarning_2026-03-13.pdf')).toBe(
      'rosa written warning 2026 03 13 pdf'
    );
    expect(normalizeFilenameForMatching('complaint_to_hr.pdf')).toBe('complaint to hr pdf');
    expect(normalizeFilenameForMatching('final-pay.record')).toBe('final pay record');
  });

  test('is null/undefined safe', () => {
    expect(normalizeFilenameForMatching(null)).toBe('');
    expect(normalizeFilenameForMatching(undefined)).toBe('');
  });
});

describe('inferCategoryFromFileName — CamelCase / separatorless filenames (regression)', () => {
  // Each of these previously missed because the pattern expected an underscore/space
  // that a CamelCase real-world filename does not contain.
  test('CamelCase filenames classify like their separated equivalents', () => {
    expect(inferCategoryFromFileName('WrittenWarning.pdf')).toBe('Performance / discipline records');
    expect(inferCategoryFromFileName('FinalPay.pdf')).toBe('Separation Records');
    expect(inferCategoryFromFileName('LetterOfSeparation.pdf')).toBe('Separation Records');
    expect(inferCategoryFromFileName('CoWorkerStatement.pdf')).toBe('Witness Statement');
    expect(inferCategoryFromFileName('OfferLetter2022.pdf')).toBe('Offer Letters');
    expect(inferCategoryFromFileName('PerformanceImprovementPlan.pdf')).toBe(
      'Performance / discipline records'
    );
  });

  test('still classifies the underscore/space forms it always did', () => {
    expect(inferCategoryFromFileName('written_warning.pdf')).toBe('Performance / discipline records');
    expect(inferCategoryFromFileName('final pay.pdf')).toBe('Separation Records');
    expect(inferCategoryFromFileName('Offer_Letter.pdf')).toBe('Offer Letters');
  });
});
