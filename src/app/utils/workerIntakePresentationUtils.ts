import type { ComposedIntakeNarrative } from '../../services/intakeNarrativeComposer';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import { truncateFileLabel } from '../../services/employmentTimelineOrganization';

/** Worker-safe display cleanup for readiness / gap lines. */
export function softenWorkerReviewLine(line: string): string {
  let s = line.trim();
  if (!s) return s;

  const replacements: Array<[RegExp, string]> = [
    [/^this may help (complete the timeline|clarify)[:\s-]*/i, ''],
    [/^additional information may help[:\s-]*/i, ''],
    [/^additional records? may help[:\s-]*/i, ''],
    [/AI\s+detected/gi, 'Available records show'],
    [/the\s+system\s+found/gi, 'Uploaded records indicate'],
    [/records appear to reference/gi, 'available records show'],
    [/violation(s)?/gi, 'topic for review'],
    [/illegal/gi, 'needs review'],
    [/strong\s+claim/gi, 'topic for review'],
    [/FLSA/gi, 'pay practices'],
    [/smoking\s+gun/gi, 'notable record'],
    [/employer\s+manipulated/gi, 'variation noted in'],
    [/Issue signal for (attorney|professional) review only:\s*/i, ''],
    [/Record pattern for review:\s*/i, ''],
    [/Flagged for attorney review/gi, 'Additional context may help clarify'],
    [/Records-related topic for review preparation:\s*/i, ''],
    [/This item may need human review because\s*/i, ''],
    [/Suggested review priority:\s*/i, ''],
    [/Additional context that may help a reviewing firm:\s*/i, ''],
    [/Indexed excerpt \(confirm in source\):\s*/i, 'From uploaded records: '],
    [/attorney should confirm/gi, 'confirm in source records'],
    [/extracted plain text/gi, 'wording in'],
    [/\bunspecified file\b/gi, 'an indexed upload'],
    [/\bundefined\b/gi, 'an indexed upload'],
  ];

  for (const [pattern, replacement] of replacements) {
    s = s.replace(pattern, replacement);
  }

  return s.replace(/\s+/g, ' ').trim();
}

/** First 2–3 sentences for always-visible record story. */
export function buildRecordStoryExcerpt(narrative: ComposedIntakeNarrative): string {
  const glance = (narrative.intakeAtAGlance ?? '').trim();
  const chronology = (narrative.chronologyOverview ?? '').trim();

  const fromGlance = glance
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)[0];

  if (fromGlance) {
    const sentences = fromGlance.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [fromGlance];
    const excerpt = sentences.slice(0, 3).join(' ').trim();
    if (excerpt.length <= 420) return excerpt;
    return `${excerpt.slice(0, 417).trim()}…`;
  }

  if (chronology) {
    const short = chronology.split(/\n/)[0]?.trim() ?? chronology;
    return short.length > 320 ? `${short.slice(0, 317)}…` : short;
  }

  return '';
}

export function buildTimelineSectionMeta(events: WorkerTimelineItem[]): string {
  if (!events.length) return 'No timeline entries yet';
  const dated = events.filter((e) => (e.date ?? '').trim() && e.date !== '—');
  const first = dated[0]?.date?.trim();
  const last = dated[dated.length - 1]?.date?.trim();
  const range =
    first && last && first !== last ? `${first} – ${last}` : first || last || 'dates being confirmed';
  return `${events.length} event${events.length === 1 ? '' : 's'} · ${range}`;
}

function parseSourceNamesFromSummary(summary: string): string[] {
  const s = summary.trim();
  const refMatch = s.match(/References?:\s*(.+?)(?:\.|$)/i);
  if (refMatch?.[1]) {
    return refMatch[1]
      .split(/,\s*/)
      .map((n) => n.trim())
      .filter(Boolean);
  }
  const filesMatch = s.match(/\b\d+\s+file\(s\):\s*(.+?)\./i);
  if (filesMatch?.[1]) {
    return filesMatch[1]
      .split(/,\s*/)
      .map((n) => n.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
  }
  return [];
}

/** Attach source file names from summary text or category-matched uploads. */
export function enrichWorkerTimelineWithSources(
  events: WorkerTimelineItem[],
  uploadedFiles: Array<{ fileName: string; category: string }>
): WorkerTimelineItem[] {
  const byCategory = new Map<string, string[]>();
  for (const f of uploadedFiles) {
    const cat = (f.category ?? '').trim() || 'Uncategorized';
    const list = byCategory.get(cat) ?? [];
    list.push(f.fileName);
    byCategory.set(cat, list);
  }

  return events.map((row) => {
    if (row.sourceFileNames?.length) {
      return {
        ...row,
        relatedDocs: row.sourceFileNames.length,
        // Prefer generation-time source trace; skip category inference.
      };
    }
    const parsed = parseSourceNamesFromSummary(row.summary ?? '');
    const fromCategory = byCategory.get((row.category ?? '').trim()) ?? [];
    const names = parsed.length ? parsed : fromCategory.slice(0, 8);
    return {
      ...row,
      sourceFileNames: names,
      relatedDocs: names.length || row.relatedDocs || 0,
    };
  });
}

export function formatSourceFileChipLabel(name: string): string {
  return truncateFileLabel(name, 28);
}
