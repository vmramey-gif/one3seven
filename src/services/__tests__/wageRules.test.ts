import { describe, it, expect } from 'vitest';
import { getWageRules } from '../wageRules';

describe('getWageRules', () => {
  it('returns the California ruleset for CA / California (any casing)', () => {
    expect(getWageRules('CA')?.code).toBe('CA');
    expect(getWageRules('California')?.code).toBe('CA');
    expect(getWageRules('ca')?.code).toBe('CA');
  });

  it('returns null for Texas — organize-only, no wage layer is built', () => {
    expect(getWageRules('TX')).toBeNull();
    expect(getWageRules('Texas')).toBeNull();
  });

  it('returns null for unset / unknown jurisdiction', () => {
    expect(getWageRules('')).toBeNull();
    expect(getWageRules(null)).toBeNull();
    expect(getWageRules(undefined)).toBeNull();
    expect(getWageRules('ZZ')).toBeNull();
  });

  it('California ruleset carries the §510 and §226.7 statutes', () => {
    const ca = getWageRules('CA');
    expect(ca?.overtimeStatute).toContain('510');
    expect(ca?.mealRestStatute).toContain('226.7');
  });
});
