import type { SourceStrength } from '../../services/intakeOrganizationTypes';

/** Timeline row shown to workers (summary + timeline screens). */
export type WorkerTimelineItem = {
  date: string;
  event: string;
  category: string;
  summary: string;
  relatedDocs: number;
  /** Supabase `timeline_events.id` when loaded from backend */
  timelineEventId?: string | null;
  /** Persisted `timeline_events.worker_context` */
  workerAddedContext?: string | null;
  /** Original upload names from generation or source trace codec */
  sourceFileNames?: string[];
  /** Source-trace date anchors from generation, preserved for presentation fallback. */
  sourceDates?: string[];
  sourceStrength?: SourceStrength | null;
  sourceExcerpt?: string | null;
  /** When true, `event` and `date` are already packet presentation output — do not re-map titles. */
  packetPresentationApplied?: boolean;
};
