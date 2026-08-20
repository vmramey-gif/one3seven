// Legacy in-memory intake workspace model, predates the Supabase-backed data layer
// (src/services/intakeDataService.ts, intake_summaries/uploaded_files tables) that is the real
// source of truth today. Still referenced as a fallback in App.tsx/IntakeSummaryScreen.tsx/
// IntakeReviewScreen.tsx -- see src/app/types/ARCHITECTURE.md for the current data flow before
// assuming this file describes it. 5 functions with zero callers anywhere in the codebase
// (getEligibleFirms, submitIntakeToFirms, addInternalReviewerNote, requestAdditionalInfo,
// routeIntakeToFirms) were removed 2026-08-20 -- confirmed dead via grep, not assumed.

export interface UploadedDocument {
  id: string;
  originalFileName: string;
  workerEditedFileName?: string;
  fileObject: File;
  category?: string;
  uploadedAt: string;
  relatedTimelineEvents?: string[];
}

export interface TimelineEvent {
  id: string;
  date: string;
  event: string;
  category: string;
  summary: string;
  relatedDocs: number;
  workerAddedContext?: string;
  relatedDocumentIds?: string[];
}

export interface DocumentCategory {
  name: string;
  count: number;
  documentIds: string[];
}

export interface OrganizationNote {
  id: string;
  type: 'info' | 'success' | 'neutral' | 'alert';
  message: string;
  detail?: string;
  timestamp: string;
}

export interface IntakeSummary {
  overview: string;
  chronology: string;
  supportingRecords: string[];
  organizationNotes: string;
  generatedAt: string;
}

export interface WorkerProvidedContext {
  mainContext?: string;
  timelineContexts: Record<string, string>; // key: timeline event id
  additionalNotes?: string;
}

export type IntakeShareStatus = 'not-shared' | 'shared' | 'submitted';
export type IntakeSaveStatus = 'unsaved' | 'saved' | 'auto-saved';
export type WorkflowStatus =
  | 'new'
  | 'additional-docs'
  | 'ready-review'
  | 'under-review'
  | 'contacted'
  | 'archived'
  | 'not-pursuing';

export interface InternalReviewerNote {
  id: string;
  content: string;
  timestamp: string;
  reviewer?: string;
  firmId?: string; // Which firm added this note
}

export interface AdditionalInfoRequest {
  id: string;
  requestedAt: string;
  categories: string[];
  note?: string;
  firmId: string;
  status: 'pending' | 'fulfilled' | 'cancelled';
}

export interface IntakeWorkspace {
  // Core identification
  id: string;
  createdAt: string;
  lastModifiedAt: string;

  // Worker information
  workerLocation?: string;
  employerState?: string;
  reportedConcerns: string[];

  // Uploaded documents
  documents: UploadedDocument[];

  // Worker-provided context
  workerContext: WorkerProvidedContext;

  // AI-organized timeline
  timelineEvents: TimelineEvent[];
  timelineComplete: boolean;

  // Document organization
  documentCategories: DocumentCategory[];

  // AI-generated intake narrative
  intakeSummary?: IntakeSummary;

  // Organization insights
  organizationNotes: OrganizationNote[];

  // Workflow state
  shareStatus: IntakeShareStatus;
  saveStatus: IntakeSaveStatus;
  submittedAt?: string;

  // Firm routing (when shared)
  sharedWithFirms: boolean;
  firmRoutingStatus?: 'pending' | 'routed' | 'reviewed';
  routedToFirmIds?: string[]; // Which firms this intake was routed to

  // Firm-side workflow management (private to firms)
  workflowStatus: WorkflowStatus;
  internalReviewerNotes: InternalReviewerNote[]; // Private - not visible to worker
  additionalInfoRequests: AdditionalInfoRequest[];

  // Firm actions tracking
  lastReviewedAt?: string;
  reviewedByFirmId?: string;

  // Export tracking
  downloadedAt?: string;
  emailedAt?: string;
}

// Helper functions
export function createEmptyIntakeWorkspace(): IntakeWorkspace {
  return {
    id: `intake-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
    lastModifiedAt: new Date().toISOString(),
    reportedConcerns: [],
    documents: [],
    workerContext: {
      timelineContexts: {},
    },
    timelineEvents: [],
    timelineComplete: false,
    documentCategories: [],
    organizationNotes: [],
    shareStatus: 'not-shared',
    saveStatus: 'unsaved',
    sharedWithFirms: false,
    workflowStatus: 'new',
    internalReviewerNotes: [],
    additionalInfoRequests: [],
  };
}

export function updateIntakeWorkspace(
  workspace: IntakeWorkspace,
  updates: Partial<IntakeWorkspace>
): IntakeWorkspace {
  return {
    ...workspace,
    ...updates,
    lastModifiedAt: new Date().toISOString(),
    saveStatus: 'unsaved',
  };
}

export function markIntakeAsSaved(workspace: IntakeWorkspace): IntakeWorkspace {
  return {
    ...workspace,
    saveStatus: 'saved',
  };
}

// Firm-side helper functions

export function updateWorkflowStatus(
  workspace: IntakeWorkspace,
  status: WorkflowStatus
): IntakeWorkspace {
  return {
    ...workspace,
    workflowStatus: status,
    lastModifiedAt: new Date().toISOString(),
  };
}
