import { describe, expect, test, vi } from 'vitest';
import { safeTrim } from '../summarySaveDiagnostics';

describe('summarySaveDiagnostics safeTrim', () => {
  test('returns trimmed string for string input', () => {
    expect(safeTrim('  hello  ', 'test.field')).toBe('hello');
  });

  test('returns empty string and logs for undefined', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(safeTrim(undefined, 'readinessIndicators[2]')).toBe('');
    expect(warn).toHaveBeenCalledWith(
      '[o3s-summary-save] trim guard',
      expect.objectContaining({
        fieldName: 'readinessIndicators[2]',
        incomingType: 'undefined',
        fallbackUsed: true,
      })
    );
    warn.mockRestore();
  });
});
