/**
 * Claim Lens gap actions — the "add to cart" logic behind the firm-side gap CTAs.
 *
 * When the attorney clicks a "no material on file" element, it joins a cart. The cart is
 * CLIENT-STATUS-AWARE, which is the doctrine + workflow hinge:
 *
 *   - prospect (not yet signed): the gaps become records the WORKER can gather on their own — a
 *     worker exercising their own right to their own records (personnel file, pay/time records,
 *     documents they signed). one3seven composes; the worker sends. Mirrors recordsRequest.ts.
 *   - client (signed): the gaps become the attorney's own discovery / follow-up worklist — a
 *     starting point, gated behind the firm confirming representation.
 *
 * Both outputs only ever NAME what is absent. They draw no conclusion about the case, cite no
 * statute as argument, and never rank or weight. Pure + deterministic so it can be unit-tested and
 * so the panel stays presentation-only.
 */

import type { RecordType } from './recordsRequest';

export type ClientStatus = 'prospect' | 'client';

export interface GapItem {
  /** Stable key (the element name) — used for cart de-dup + toggle. */
  key: string;
  /** The element label, verbatim from the lens (e.g. "Wage statements on file"). */
  element: string;
  /** The absence line shown on the gap card (el.empty). */
  note: string;
}

const RECORD_LABEL: Record<RecordType, string> = {
  personnel_file: 'personnel file',
  pay_records: 'pay records',
  time_records: 'time records',
  signed_documents: 'documents you signed',
};

/**
 * Map a gap element to the worker record a copy-request would target, when it clearly corresponds.
 * Conservative on purpose: an unmapped gap still lists as a plain follow-up line, never a wrong
 * record type. Order matters — more specific patterns first.
 */
export function suggestedRecordType(elementName: string): RecordType | null {
  const s = elementName.toLowerCase();
  if (/\b(time|hours?|meal|rest|break|clock|schedule|shift)\b/.test(s)) return 'time_records';
  if (/\b(pay|wage statement|wage statements|pay ?stub|paystub|overtime|compensation|earnings|itemized)\b/.test(s)) return 'pay_records';
  if (/\b(arbitration|handbook|acknowledg|signed|agreement|policy|policies|onboarding|offer letter)\b/.test(s)) return 'signed_documents';
  if (/\b(personnel|discipline|disciplinary|warning|write-?up|evaluation|performance|review|complaint|hr|termination|separation)\b/.test(s)) return 'personnel_file';
  return null;
}

/** Distinct record types the cart maps onto (for the "request your X" summary). */
export function cartRecordTypes(gaps: GapItem[]): RecordType[] {
  const seen = new Set<RecordType>();
  for (const g of gaps) {
    const t = suggestedRecordType(g.element);
    if (t) seen.add(t);
  }
  return (['personnel_file', 'pay_records', 'time_records', 'signed_documents'] as RecordType[]).filter((t) => seen.has(t));
}

/**
 * PROSPECT output — records the worker can gather themselves. Plain language, worker-owned, no
 * statute argument. one3seven composes; the worker sends from their own email.
 */
export function buildWorkerGatherList(gaps: GapItem[]): string {
  if (!gaps.length) return '';
  const types = cartRecordTypes(gaps);
  const lines: string[] = [];
  lines.push('Records to gather — copies of your own employment records.');
  lines.push('You have the right to request copies of your own records. one3seven will compose each request; you send it from your own email.');
  lines.push('');
  for (const g of gaps) {
    const t = suggestedRecordType(g.element);
    lines.push(t ? `• ${g.element} — request your ${RECORD_LABEL[t]}` : `• ${g.element}`);
  }
  if (types.length) {
    lines.push('');
    lines.push(`Record types to request: ${types.map((t) => RECORD_LABEL[t]).join(', ')}.`);
  }
  return lines.join('\n');
}

/**
 * CLIENT output — the attorney's own discovery / follow-up worklist. Names absences only; a
 * starting point, not a conclusion. Header carries the theory for context.
 */
export function buildFirmWorklist(gaps: GapItem[], theoryTitle: string): string {
  if (!gaps.length) return '';
  const lines: string[] = [];
  lines.push(`Follow-up worklist — ${theoryTitle}`);
  lines.push('Elements with no material on file (a starting point for discovery; one3seven draws no conclusions):');
  lines.push('');
  for (const g of gaps) {
    lines.push(`• ${g.element}${g.note ? ` — ${g.note}` : ''}`);
  }
  lines.push('');
  lines.push('Confirm the client is represented before directing any records-gathering.');
  return lines.join('\n');
}

/** The output text for the current client status. */
export function buildCartOutput(gaps: GapItem[], status: ClientStatus, theoryTitle: string): string {
  return status === 'prospect' ? buildWorkerGatherList(gaps) : buildFirmWorklist(gaps, theoryTitle);
}
