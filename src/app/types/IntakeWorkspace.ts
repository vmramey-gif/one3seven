// Shared intake workspace architecture for One3Seven
// This represents the single source of truth for both worker and firm views

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

export function submitIntakeToFirms(workspace: IntakeWorkspace): IntakeWorkspace {
  return {
    ...workspace,
    shareStatus: 'submitted',
    submittedAt: new Date().toISOString(),
    sharedWithFirms: true,
    firmRoutingStatus: 'pending',
    lastModifiedAt: new Date().toISOString(),
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

export function addInternalReviewerNote(
  workspace: IntakeWorkspace,
  content: string,
  reviewer?: string,
  firmId?: string
): IntakeWorkspace {
  const newNote: InternalReviewerNote = {
    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content,
    timestamp: new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    reviewer,
    firmId,
  };

  return {
    ...workspace,
    internalReviewerNotes: [newNote, ...workspace.internalReviewerNotes],
    lastModifiedAt: new Date().toISOString(),
  };
}

export function requestAdditionalInfo(
  workspace: IntakeWorkspace,
  categories: string[],
  note: string | undefined,
  firmId: string
): IntakeWorkspace {
  const request: AdditionalInfoRequest = {
    id: `request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    requestedAt: new Date().toISOString(),
    categories,
    note,
    firmId,
    status: 'pending',
  };

  return {
    ...workspace,
    additionalInfoRequests: [...workspace.additionalInfoRequests, request],
    workflowStatus: 'additional-docs',
    lastModifiedAt: new Date().toISOString(),
  };
}

export function routeIntakeToFirms(
  workspace: IntakeWorkspace,
  firmIds: string[]
): IntakeWorkspace {
  return {
    ...workspace,
    routedToFirmIds: firmIds,
    firmRoutingStatus: 'routed',
    lastModifiedAt: new Date().toISOString(),
  };
}

// Intake routing logic - determines which firms should see a given intake
export function getEligibleFirms(workspace: IntakeWorkspace, firmPreferences: any[]): string[] {
  // In production, this would check:
  // - Geography match (firm covers worker location / employer state)
  // - Category match (firm accepts these intake categories)
  // - Document completeness (firm readiness threshold)
  // - Firm subscription/routing settings

  // For now, return all firm IDs as eligible
  return firmPreferences.map(pref => pref.firmId);
}

