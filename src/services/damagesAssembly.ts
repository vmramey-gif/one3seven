/**
 * Assembles a DamagesCalculatorInput from the firm-only wage facts forwarded by the
 * intelligence synthesizer. This is the highest-risk step: a wrong number in an attorney
 * tool is worse than no number, so the guard is deliberately conservative —
 *
 *   • No parseable base hourly rate anywhere in the records  → return null (do not estimate).
 *   • Conflicting base rates across records (ambiguous)       → return null (do not estimate).
 *
 * Only an unambiguous base rate produces an input. calculateDamages applies the same
 * no-base-rate guard again (defense in depth). The verbatim source snippet is carried as
 * the citation; page/char offsets are left at 0 (CitationPanel locates via pdf.js — F5).
 */

import type { WageFactsDocument } from './documentFactsService';
import type { DamagesCalculatorInput, ProvenancedNumber, SourceCitation } from './damagesCalculator';

/** Parse a money string ("$22.00/hr", "$22.00 per hour", "22.00", "$1,250.50") to a number. */
export function parseMoney(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parse a plain numeric quantity (hours, counts) to a non-negative number. */
export function parseQuantity(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function citationFor(doc: WageFactsDocument, snippet: string | undefined): SourceCitation | null {
  if (!snippet || !snippet.trim()) return null;
  return {
    docId: doc.docId,
    docName: doc.docName,
    page: 0, // hint only — CitationPanel locates the snippet in the rendered PDF
    charStart: 0,
    charEnd: 0,
    sourceText: snippet.trim(),
  };
}

const PAY_RECORD = /pay|payroll|paystub|wage/i;

export interface AssembledDamages {
  input: DamagesCalculatorInput;
  /** Document the authoritative base rate was read from (for surfacing/debug). */
  baseRateDocName: string;
}

/**
 * Returns a calculator input only when an unambiguous base hourly rate is present.
 * Returns null otherwise — the caller must treat null as "no estimate".
 */
export function assembleDamagesInput(docs: WageFactsDocument[]): AssembledDamages | null {
  if (!Array.isArray(docs) || docs.length === 0) return null;

  // --- Base hourly rate: must be present and unambiguous. ---
  const rateCandidates = docs
    .map((d) => ({ doc: d, rate: parseMoney(d.payRate) }))
    .filter((c): c is { doc: WageFactsDocument; rate: number } => c.rate !== null);

  if (rateCandidates.length === 0) return null; // no rate in records → do not estimate

  const distinctRates = new Set(rateCandidates.map((c) => c.rate.toFixed(2)));
  if (distinctRates.size > 1) return null; // conflicting rates → ambiguous → do not estimate

  const baseRateDoc = rateCandidates[0].doc;
  const regularHourlyRate: ProvenancedNumber = {
    value: rateCandidates[0].rate,
    citation: citationFor(baseRateDoc, baseRateDoc.sources.pay_rate),
  };

  // --- Overtime rate actually applied (if any record states one). Conflicting → unknown (null). ---
  const otRateCandidates = docs
    .map((d) => ({ doc: d, rate: parseMoney(d.overtimeRate) }))
    .filter((c): c is { doc: WageFactsDocument; rate: number } => c.rate !== null);
  const distinctOtRates = new Set(otRateCandidates.map((c) => c.rate.toFixed(2)));
  const overtimeRateApplied: ProvenancedNumber =
    otRateCandidates.length > 0 && distinctOtRates.size === 1
      ? { value: otRateCandidates[0].rate, citation: citationFor(otRateCandidates[0].doc, otRateCandidates[0].doc.sources.overtime_rate) }
      : { value: null, citation: null };

  // --- Overtime hours worked: sum across records that state OT hours. ---
  const otHourDocs = docs.filter((d) => parseQuantity(d.overtimeHours) !== null);
  const otHoursTotal = otHourDocs.reduce((sum, d) => sum + (parseQuantity(d.overtimeHours) ?? 0), 0);
  const overtimeHoursWorked: ProvenancedNumber = otHourDocs.length
    ? { value: otHoursTotal, citation: citationFor(otHourDocs[0], otHourDocs[0].sources.overtime_hours) }
    : { value: null, citation: null };

  // --- Missed meal breaks: sum across records that state a count. ---
  const breakDocs = docs.filter((d) => parseQuantity(d.missedBreaks) !== null);
  const breaksTotal = breakDocs.reduce((sum, d) => sum + (parseQuantity(d.missedBreaks) ?? 0), 0);
  const mealBreaksMissed: ProvenancedNumber = breakDocs.length
    ? { value: breaksTotal, citation: citationFor(breakDocs[0], breakDocs[0].sources.missed_breaks) }
    : { value: null, citation: null };

  // Pay periods present = count of pay/payroll records. Expected span is not derivable
  // from records alone, so it stays 0 (unknown) — partial-data is then driven only by
  // genuinely absent OT/meal inputs, never by a fabricated "expected" count.
  const payPeriodsPresent = docs.filter(
    (d) => (d.category && PAY_RECORD.test(d.category)) || parseMoney(d.payRate) !== null,
  ).length;

  return {
    input: {
      regularHourlyRate,
      overtimeRateApplied,
      overtimeHoursWorked,
      mealBreaksMissed,
      payPeriodsPresent,
      expectedPayPeriods: 0,
    },
    baseRateDocName: baseRateDoc.docName,
  };
}
