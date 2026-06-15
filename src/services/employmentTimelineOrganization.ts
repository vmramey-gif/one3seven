import type { WorkerTimelineItem } from '../app/types/workerTimeline';
import {
  DATE_UNCLEAR_LABEL,
  bestEmploymentChronologyAnchor,
  compareEmploymentChronologyDates,
} from './contextualDateClassification';
import { materialsMayReflectPhrase } from './intakeGenerationVoice';
import { chronologyPhaseTitle } from './intakeOrganizerReasoning';

export type UploadedFileMeta = {
  fileName: string;
  category: string;
  uploadedFileId?: string;
};

type IntellectualTimelineEvent = {
  id: string;
  eventDate: string;
  title: string;
  category: string;
  aiSummary: string;
  sourceFileNames: string[];
};
/** Stable key for upload session maps (labels, removals). */
export function uploadedFileKey(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function truncateFileLabel(name: string, maxChars = 24): string {
  const trimmed = (name ?? '').trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxChars - 1))}.`;
}

function inferEmploymentDateFromFileNames(names: string[]): string {
  const corpus = names.join('\n');
  const anchor = bestEmploymentChronologyAnchor(corpus);
  return anchor === DATE_UNCLEAR_LABEL ? '' : anchor;
}

/**
 * Group uploads by category into phases (filename year hints only).
 * Avoids a naive one-card-per-upload timeline.
 */
export function buildIntellectualTimelineEvents(files: UploadedFileMeta[]): IntellectualTimelineEvent[] {
  const grouped = new Map<string, string[]>();
  for (const f of files) {
    const category = (f.category ?? '').trim() || 'Uncategorized';
    const list = grouped.get(category) ?? [];
    list.push(f.fileName);
    grouped.set(category, list);
  }

  const phases: IntellectualTimelineEvent[] = [];
  let i = 0;
  for (const [category, names] of grouped) {
    const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
    const year = inferEmploymentDateFromFileNames(sortedNames);
    const phaseTitle = chronologyPhaseTitle(category, year ? [year] : []);
    phases.push({
      id: `org-${i++}`,
      eventDate: year || DATE_UNCLEAR_LABEL,
      title: phaseTitle,
      category,
      aiSummary: materialsMayReflectPhrase(
        `${phaseTitle.toLowerCase()} in this part of the sequence.`
      ),
      sourceFileNames: sortedNames,
    });
  }

  phases.sort((a, b) => {
    const dateCmp = compareEmploymentChronologyDates(a.eventDate, b.eventDate);
    if (dateCmp !== 0) return dateCmp;
    return a.title.localeCompare(b.title);
  });

  return phases;
}

export function intellectualEventsToWorkerTimeline(events: IntellectualTimelineEvent[]): WorkerTimelineItem[] {
  return events.map((e) => ({
    date: e.eventDate || DATE_UNCLEAR_LABEL,
    event: e.title,
    category: e.category,
    summary: e.aiSummary,
    relatedDocs: e.sourceFileNames.length,
    sourceFileNames: e.sourceFileNames,
  }));
}

export function condenseWorkerTimelineForSummary(
  timeline: WorkerTimelineItem[],
  intakeStoryNotes: string,
  _uploadFileMetas: Array<{ fileName: string; displayName?: string; category: string }>
): WorkerTimelineItem[] {
  void _uploadFileMetas;
  const maxRows = 120;
  const base = timeline.map((t) => ({ ...t }));

  if (intakeStoryNotes.trim() && base.length > 0) {
    const first = base[0];
    base[0] = {
      ...first,
      summary: [first.summary, `Notes: ${intakeStoryNotes.trim()}`].filter(Boolean).join(' '),
    };
  }

  const seen = new Set<string>();
  const out: WorkerTimelineItem[] = [];
  for (const item of base) {
    const key = `${item.date}|${item.event}|${item.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }

  return out.slice(0, maxRows);
}