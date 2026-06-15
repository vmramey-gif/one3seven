/**
 * Tier readiness presentation: brief supplemental notes vs detailed indexing/extraction diagnostics.
 * Data is preserved; presentation is condensed, grouped, and de-emphasized for attorney skim flow.
 */

const READINESS_ISSUE_PREFIX = 'Additional context may help clarify: ';
const LEGACY_READINESS_ISSUE_PREFIX = 'Flagged for attorney review: ';

function readinessIssuePrefixMatch(line: string): { matched: boolean; rest: string } {
  if (line.startsWith(READINESS_ISSUE_PREFIX)) {
    return { matched: true, rest: line.slice(READINESS_ISSUE_PREFIX.length) };
  }
  if (line.startsWith(LEGACY_READINESS_ISSUE_PREFIX)) {
    return { matched: true, rest: line.slice(LEGACY_READINESS_ISSUE_PREFIX.length) };
  }
  return { matched: false, rest: '' };
}
const RECORDS_TOPIC_PREFIX = 'Records suggest a review topic: ';
const SUGGESTED_REVIEW_PREFIX = 'May need review: ';
const ADDITIONAL_CONTEXT_PREFIX = 'Additional records may help clarify: ';
const INDEXED_EXCERPT_PREFIX = 'From uploaded records: ';
const HUMAN_REVIEW_PREFIX = 'This item may need human review because ';

export type ReadinessPresentation = {
  /** Short bullets shown without collapsing (skim-first). */
  supplementalBrief: string[];
  /** One-line summaries of indexing/extraction volume (PDF §8 header). */
  operationalSummary: string[];
  /** Full diagnostic lines (collapsible in app; appendix in PDF). */
  operationalDetail: string[];
};

function mapIssueHeading(internalLower: string): string | null {
  if (/wage|hour|payroll/.test(internalLower)) return 'Payroll / wage topics';
  if (/scheduling|attendance|meal|rest|leave/.test(internalLower)) return 'Scheduling / timekeeping topics';
  if (/termination|separation/.test(internalLower)) return 'Separation / final pay topics';
  if (/hr|complaint|workplace communication/.test(internalLower)) return 'HR / workplace communication topics';
  if (/disability|accommodation|pregnancy|medical-leave/.test(internalLower)) return 'Leave / accommodation topics';
  if (/contract|classification|promised-pay/.test(internalLower)) return 'Classification / pay-structure topics';
  return null;
}

/** Attorney-facing display cleanup (does not mutate stored readiness). */
export function sanitizeReadinessDisplayLine(line: string): string {
  return line
    .replace(/[""]undefined[""]/gi, 'an uploaded file')
    .replace(/\bin\s+[""]undefined[""]/gi, 'in one upload')
    .replace(/\bin\s+undefined\b/gi, 'in one upload')
    .replace(/\bundefined\b/gi, 'an indexed upload')
    .replace(/\bunspecified file\b/gi, 'an indexed upload')
    .replace(/records appear to reference/gi, 'available records show')
    .replace(/extracted plain text in/gi, 'wording in')
    .replace(/attorney should confirm/gi, 'confirm in source records')
    .replace(/document text includes neutral terms such as/gi, 'wording references')
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoiseLine(line: string): boolean {
  const low = line.toLowerCase();
  if (!line.trim()) return true;
  if (low.includes('worker-provided context (if any) is stored')) return true;
  if (low.includes('was compared to document text for repeated neutral terms')) return true;
  if (low.includes('this packet organizes records and worker-provided context')) return true;
  if (/^firm quick snapshot:/i.test(line)) return true;
  if (low.includes('records show (excerpt')) return true;
  return false;
}

function isOperationalDetailLine(line: string): boolean {
  const low = line.toLowerCase();
  if (line.startsWith(INDEXED_EXCERPT_PREFIX)) return true;
  if (line.startsWith(ADDITIONAL_CONTEXT_PREFIX)) return true;
  if (/source text in\s+[""]/i.test(line) || /source text in\s+"/i.test(line)) return true;
  if (low.includes('suggested category from document wording')) return true;
  if (low.includes('did not clearly suggest a bucket')) return true;
  if (low.startsWith('document wording for ')) return true;
  if (low.includes('document wording and the stored initial category tag')) return true;
  if (/length-limited|quality flags|empty text layer|unsupported format/i.test(low)) return true;
  if (low.startsWith('indexed excerpt')) return true;
  return false;
}

function buildOperationalSummaries(detail: string[]): string[] {
  let sourceDigests = 0;
  let categoryHints = 0;
  let excerpts = 0;
  let qualityNotes = 0;

  for (const line of detail) {
    const low = line.toLowerCase();
    if (/source text in/i.test(low) && /employee name|employer|pay period|gross|net|communication/i.test(low)) {
      sourceDigests++;
    } else if (low.includes('suggested category from document wording') || low.includes('did not clearly suggest')) {
      categoryHints++;
    } else if (line.startsWith(INDEXED_EXCERPT_PREFIX) || low.startsWith('indexed excerpt')) {
      excerpts++;
    } else if (/length-limited|quality|empty text|unsupported/i.test(low)) {
      qualityNotes++;
    }
  }

  const out: string[] = [];
  if (sourceDigests > 0) {
    out.push(
      `Source-text digests (payroll/communications) were captured for ${sourceDigests} file${sourceDigests === 1 ? '' : 's'}; open detailed notes below when needed.`
    );
  }
  if (categoryHints > 0) {
    out.push(
      `${categoryHints} category wording hint${categoryHints === 1 ? '' : 's'} may need manual confirmation against how files were tagged at upload.`
    );
  }
  if (excerpts > 0) {
    out.push(`${excerpts} short excerpt${excerpts === 1 ? '' : 's'} from source text appear in the detailed notes below.`);
  }
  if (qualityNotes > 0) {
    out.push(
      `${qualityNotes} file${qualityNotes === 1 ? '' : 's'} may have extraction quality limits; see detailed notes before relying on indexed text alone.`
    );
  }
  return out;
}

/**
 * Split stored readiness indicators into skim-first vs supplemental indexing/extraction detail.
 */
export function partitionReadinessForDisplay(readiness: string[]): ReadinessPresentation {
  const supplementalBrief: string[] = [];
  const operationalDetail: string[] = [];
  const seenBrief = new Set<string>();
  const seenDetail = new Set<string>();

  const pushBrief = (s: string) => {
    const t = sanitizeReadinessDisplayLine(s);
    if (!t || seenBrief.has(t) || isNoiseLine(t)) return;
    seenBrief.add(t);
    supplementalBrief.push(t);
  };

  const pushDetail = (s: string) => {
    const t = sanitizeReadinessDisplayLine(s);
    if (!t || seenDetail.has(t) || isNoiseLine(t)) return;
    seenDetail.add(t);
    operationalDetail.push(t);
  };

  for (let i = 0; i < readiness.length; i++) {
    const raw = readiness[i]?.trim() ?? '';
    if (!raw) continue;

    const issue = readinessIssuePrefixMatch(raw);
    if (issue.matched) {
      const rest = issue.rest;
      const internal = (rest.split(':')[0] ?? rest).trim().toLowerCase();
      const heading = mapIssueHeading(internal);
      if (heading) {
        pushBrief(`${heading} — referenced in uploaded text; confirm in source files.`);
      }
      const next = readiness[i + 1]?.trim() ?? '';
      if (next.startsWith(ADDITIONAL_CONTEXT_PREFIX)) {
        pushDetail(next);
        i++;
      }
      continue;
    }

    if (raw.startsWith(RECORDS_TOPIC_PREFIX)) {
      const body = raw.slice(RECORDS_TOPIC_PREFIX.length).replace(/\.$/, '').trim();
      const label = (body.split(':')[0] ?? '').trim();
      const tail = sanitizeReadinessDisplayLine(body.replace(/^[^:]+:\s*/, ''));
      pushBrief(
        label
          ? `${label} — ${tail || 'wording in uploads may relate to this topic area.'}`
          : tail || 'Topic wording appears in the uploads.'
      );
      continue;
    }

    if (raw.startsWith(HUMAN_REVIEW_PREFIX)) {
      pushBrief(raw.slice(HUMAN_REVIEW_PREFIX.length));
      continue;
    }

    if (raw.startsWith(SUGGESTED_REVIEW_PREFIX)) {
      pushBrief(raw.slice(SUGGESTED_REVIEW_PREFIX.length));
      continue;
    }

    if (/^Intake completeness:/i.test(raw)) {
      pushBrief(raw);
      continue;
    }

    if (/^A reviewing professional may want to confirm/i.test(raw)) {
      pushDetail(raw);
      continue;
    }

    if (raw.startsWith(ADDITIONAL_CONTEXT_PREFIX) || isOperationalDetailLine(raw)) {
      pushDetail(raw);
      continue;
    }

    if (/^Information sufficiency \(organizational\):/i.test(raw)) {
      pushBrief(raw.replace(/^Information sufficiency \(organizational\):\s*/i, 'Intake completeness: '));
      continue;
    }

    if (/\bupload\(s\)\s+did not have completed text extraction\b/i.test(raw)) {
      pushBrief(raw);
      continue;
    }

    if (isOperationalDetailLine(raw) || /source text in/i.test(raw.toLowerCase())) {
      pushDetail(raw);
    } else if (!isNoiseLine(raw)) {
      pushBrief(raw);
    }
  }

  const operationalSummary = buildOperationalSummaries(operationalDetail);

  return {
    supplementalBrief: supplementalBrief.slice(0, 8),
    operationalSummary,
    operationalDetail: operationalDetail.slice(0, 32),
  };
}

/** PDF / export §8 body: summary first, then optional detailed appendix. */
export function formatReadinessForExportPacket(readiness: string[]): string[] {
  if (!readiness.length) {
    return ['Additional organizational signals may be added as the intake record set grows.'];
  }
  const { supplementalBrief, operationalSummary, operationalDetail } = partitionReadinessForDisplay(readiness);
  const out: string[] = [...supplementalBrief];
  for (const s of operationalSummary) {
    if (!out.includes(s)) out.push(s);
  }
  if (operationalDetail.length) {
    out.push('Detailed indexing notes (supplemental):');
    for (const d of operationalDetail) out.push(d);
  }
  return out.length ? out : ['No supplemental indexing notes were stored for this packet.'];
}
