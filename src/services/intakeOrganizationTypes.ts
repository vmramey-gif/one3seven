/** Source linkage strength for timeline events and review flags. */
export type SourceStrength = 'strong' | 'partial' | 'inferred' | 'needs_review';

export type ExtractionQuality = 'high' | 'medium' | 'low' | 'unreadable';

export type IntakeFilePossibleTimelineEvent = {
  title: string;
  date: string | null;
  neutral_summary: string;
};

/** Structured per-upload organization metadata (persisted in O3S_ORG_ENGINE). */
export type IntakeFileOrganizationRecord = {
  source_file_id: string;
  file_name: string;
  document_type: string;
  legacy_upload_category: string | null;
  likely_date: string | null;
  people_or_entities: string[];
  employment_topics: string[];
  possible_timeline_event: IntakeFilePossibleTimelineEvent | null;
  supporting_record_strength: SourceStrength;
  missing_or_unclear_information: string[];
  confidence: 'high' | 'medium' | 'low';
  extraction_quality: ExtractionQuality;
};

/** Evidence-mapped timeline cluster (Phase 2). */
export type EvidenceMappedTimelineEvent = {
  date: string;
  title: string;
  neutral_summary: string;
  people_involved: string[];
  supporting_file_ids: string[];
  supporting_file_names: string[];
  related_topics: string[];
  gaps_or_uncertainties: string[];
  confidence: 'high' | 'medium' | 'low';
  category: string;
  source_strength: SourceStrength;
};

/** Structured review summary sections (Phase 3). */
export type IntakeOrganizationSections = {
  executive_summary: string;
  chronology: string[];
  people_and_entities: string[];
  supporting_records: Array<{
    file_id: string;
    file_name: string;
    strength: SourceStrength;
    note: string;
  }>;
  potential_gaps: string[];
  clarification_items: string[];
  review_notes: string[];
  disclaimer: string;
};

export type IntakeOrgEnginePayload = {
  version: 1;
  file_records: IntakeFileOrganizationRecord[];
  people_index: string[];
  generated_at: string;
  timeline_events?: EvidenceMappedTimelineEvent[];
  sections?: IntakeOrganizationSections;
};

export type DocumentGroundedFileInput = {
  uploadedFileId: string;
  fileName: string;
  category: string | null;
  extractedText: string;
  qualityFlags?: Record<string, unknown> | null;
};

export type TimelineSourceTrace = {
  sourceFileIds: string[];
  sourceFileNames: string[];
  sourceDocumentTypes: string[];
  sourceDates: string[];
  sourceStrength: SourceStrength;
  /** Short excerpt from source text when available. */
  sourceExcerpt?: string | null;
};

export type OrganizationTimelineEvent = {
  eventDate: string;
  title: string;
  category: string;
  aiSummary: string;
  source: TimelineSourceTrace;
  unresolvedQuestions?: string[];
};

export type ReviewCheckItem = {
  title: string;
  whyNeedsReview: string;
  supportingRecords: string[];
  clarifyingRecord?: string | null;
};

export type PlaceholderOrganizationResult = {
  /** 3–6 sentence calm narrative for worker “record story” block. */
  recordStory: string;
  /** Concise firm-facing chronology + review snapshot (plain language). */
  firmReviewSummary: string;
  timelineSummary: string;
  timelineEvents: OrganizationTimelineEvent[];
  documentCategories: Array<{ name: string; count: number }>;
  readinessIndicators: string[];
  missingDocumentSuggestions: string[];
  /** Structured overview for persistence (shorter than legacy multi-section wall). */
  overview: string;
  reviewItems: ReviewCheckItem[];
  /** Per-file intake organization records (Phase 1 engine). */
  fileRecords: IntakeFileOrganizationRecord[];
  /** Deduped people/entities across file records. */
  peopleIndex: string[];
  /** Evidence-mapped timeline clusters (Phase 2). */
  evidenceTimeline: EvidenceMappedTimelineEvent[];
  /** Structured organizational sections (Phase 3). */
  sections: IntakeOrganizationSections;
};
