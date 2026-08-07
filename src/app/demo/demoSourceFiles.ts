/**
 * Static-file lookup for the sales demo's citation-click flow (/sales-demo-7k2m9x4p).
 *
 * The demo has zero backend (see personaDemoData.ts) so `IntakeReviewScreen`'s real
 * `openQuoteCitation` — which signs a Supabase Storage URL — has nothing to resolve for
 * demo personas. This module maps each persona's cited source file name to a REAL static
 * PDF checked into `public/sales-demo-sources/` (generated once, see project memory /
 * scratchpad build script; not part of the shipped build pipeline). Those 30 PDFs contain
 * the exact quoted text as genuine extractable PDF text, so the real `CitationPanel`
 * (pdf.js text search + violet highlight) can run against them unmodified.
 *
 * `getDemoSourceUrl` is passed into `IntakeReviewScreen` as `demoSourceUrlResolver` — the
 * only hook that component exposes for this. It does a same-origin relative fetch (plain
 * static asset, like any other file under `public/`), so it does not violate the demo's
 * "zero backend/network calls" isolation rule.
 */
import { normalizeFilenameForMatching } from '../../services/filenameMatching';

const BASE = '/sales-demo-sources';

/** personaId -> source file name -> static PDF slug (see gen script for the exact mapping). */
const SLUGS_BY_PERSONA: Record<string, Record<string, string>> = {
  p1: {
    'Offer Letter - Marcus Webb.pdf': 'p1-offer-letter',
    'Webb Pay Stub 2025-05-09.pdf': 'p1-pay-stub-0509',
    'Webb Pay Stub 2025-05-23.pdf': 'p1-pay-stub-0523',
    'TeamShift_Schedule_Week_May05_2025.pdf': 'p1-schedule',
    'Classification question email - Webb.pdf': 'p1-classification-email',
    'Termination Letter - Webb.pdf': 'p1-termination-letter',
  },
  p2: {
    '2024 Annual Performance Review - Reyes-Okafor.pdf': 'p2-performance-review',
    'Pregnancy announcement email 2025-03-10.pdf': 'p2-pregnancy-email',
    'Leave of Absence Request - Reyes-Okafor.pdf': 'p2-loa-request',
    'Performance Improvement Plan - D Reyes-Okafor.pdf': 'p2-pip',
    'Termination Letter - Reyes-Okafor.pdf': 'p2-termination-letter',
    'Final Pay Stub - Reyes-Okafor 2025-05-02.pdf': 'p2-final-pay-stub',
  },
  p3: {
    'Forklift safety report email - Ferreira.pdf': 'p3-forklift-safety-email',
    'CalOSHA Complaint - scanned copy.pdf': 'p3-calosha-complaint',
    'Corrective Action Notice - Ferreira 03-12-2025.pdf': 'p3-corrective-action',
    'Attendance Policy - Team Handbook p14.pdf': 'p3-attendance-policy',
    'Text thread - R Peavey Feb-Mar 2025.pdf': 'p3-text-thread-feb-mar',
    'Text thread - employment ended 03-21-2025.pdf': 'p3-text-thread-ended',
  },
  p4: {
    'Work Status Report - Baptiste 04-07-2025.pdf': 'p4-work-status-report',
    'Accommodation request email - Baptiste.pdf': 'p4-accommodation-request-email',
    'RE Accommodation request - HR response.pdf': 'p4-hr-response-email',
    'Escrow Assistant Job Description.pdf': 'p4-job-description',
    'Termination Letter - Baptiste.pdf': 'p4-termination-letter',
    'IMG_2047.pdf': 'p4-img-2047',
  },
  p5: {
    'Time Punch Export May 1-15 2025 - Maldonado.pdf': 'p5-time-punch-export',
    'Reporte de Horas 16-31 mayo 2025.pdf': 'p5-reporte-de-horas',
    'Casa Tejocote Pay Stub 2025-05-23.pdf': 'p5-pay-stub',
    'Employee Handbook - Meal and Rest Breaks p11.pdf': 'p5-handbook-meal-rest',
    'Termination texts - June 6 2025.pdf': 'p5-termination-texts',
    'Final Check Stub 2025-06-18.pdf': 'p5-final-check-stub',
  },
};

/** Pre-normalized (same key normalization production citation-matching uses) for lookup robustness. */
const NORMALIZED_SLUGS_BY_PERSONA: Record<string, Map<string, string>> = Object.fromEntries(
  Object.entries(SLUGS_BY_PERSONA).map(([personaId, byFileName]) => [
    personaId,
    new Map(Object.entries(byFileName).map(([fileName, slug]) => [normalizeFilenameForMatching(fileName), slug])),
  ]),
);

/** Given a persona id and a cited source file name, returns the static public URL for its
 * generated demo PDF, or null if this persona/file has no static source (shouldn't happen
 * for the 30 documents the demo cites, but the caller treats null as "no source available"
 * exactly like the real app does for an unsigned URL). */
export function getDemoSourceUrl(personaId: string, fileName: string): string | null {
  const byName = NORMALIZED_SLUGS_BY_PERSONA[personaId];
  if (!byName) return null;
  const slug = byName.get(normalizeFilenameForMatching(fileName));
  if (!slug) return null;
  return `${BASE}/${slug}.pdf`;
}

/** Builds the `demoSourceUrlResolver` callback IntakeReviewScreen expects, bound to one persona. */
export function createDemoSourceUrlResolver(personaId: string): (fileName: string) => string | null {
  return (fileName: string) => getDemoSourceUrl(personaId, fileName);
}
