/**
 * Phase 2b — communication parties.
 * Validates/normalizes the `communication_parties` array produced by extraction:
 * the people party to communications in a document (sender, recipient, and anyone
 * explicitly named), each with the role/title exactly as the document states it.
 *
 * Pure and deterministic. Capture-only — names and roles are taken verbatim from
 * the document, never inferred. Both fields run through the shared banned-vocabulary
 * scrubber so no party label can carry a legal conclusion. Organizes who-communicated;
 * never interprets the relationship beyond what the text states.
 */

import { sanitizeGenerationPhrase } from './intakeGenerationVoice';

export type CommunicationParty = { name: string; role: string };

/** Max parties surfaced per document. */
export const MAX_COMMUNICATION_PARTIES = 12;

const MAX_NAME_LENGTH = 120;
const MAX_ROLE_LENGTH = 80;

export function normalizeCommunicationParties(raw: unknown): CommunicationParty[] {
  if (!Array.isArray(raw)) return [];

  const out: CommunicationParty[] = [];
  const seen = new Set<string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const rawName = (entry as { name?: unknown }).name;
    const rawRole = (entry as { role?: unknown }).role;

    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (!name || name.length > MAX_NAME_LENGTH) continue;
    const cleanName = sanitizeGenerationPhrase(name);
    if (!cleanName) continue;

    let role = typeof rawRole === 'string' ? rawRole.trim() : '';
    role = role && role.length <= MAX_ROLE_LENGTH ? sanitizeGenerationPhrase(role) : '';

    const key = cleanName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    out.push({ name: cleanName, role });
    if (out.length >= MAX_COMMUNICATION_PARTIES) break;
  }

  return out;
}
