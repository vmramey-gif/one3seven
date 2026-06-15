/** Timeline row used across summary, worker timeline, and detail navigation */
export type TimelineCardModel = {
  /** Supabase `timeline_events.id` when available */
  timelineEventId?: string;
  date: string;
  event: string;
  category: string;
  summary: string;
  relatedDocs: number;
  /** Persisted worker narrative for this event */
  workerAddedContext?: string;
};
