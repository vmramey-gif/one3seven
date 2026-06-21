import { californiaWageRules } from './californiaWageRules';
import type { JurisdictionRuleset } from './types';

export type { JurisdictionRuleset } from './types';

/** Normalize a worker-provided state (postal code or full name) to a 2-letter code. */
function normalizeState(raw: string | null | undefined): string {
  const s = (raw ?? '').trim().toUpperCase();
  if (!s) return '';
  if (s === 'CALIFORNIA') return 'CA';
  if (s === 'TEXAS') return 'TX';
  return s.length === 2 ? s : '';
}

/**
 * Returns the wage-exposure ruleset for a jurisdiction, or null when none exists.
 *
 * Only California has a wage-exposure layer. Texas and every other state — and an unset work
 * state — return null, which makes Section 8B genuinely unreachable for them: the caller exits
 * before any wage assembly or calculation runs (organize-only). Texas's wage layer is
 * intentionally not built; adding a jurisdiction is a matter of adding its ruleset module here.
 */
export function getWageRules(state: string | null | undefined): JurisdictionRuleset | null {
  return normalizeState(state) === 'CA' ? californiaWageRules : null;
}
