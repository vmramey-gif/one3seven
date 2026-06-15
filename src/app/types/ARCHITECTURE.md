# One3Seven Shared Intake Workspace Architecture

## Overview

One3Seven uses a **shared intake workspace** architecture where worker-side and law firm-side views access the same underlying intake record. This ensures all worker-provided information remains connected throughout the intake lifecycle.

## Core Principles

### 1. Single Source of Truth

Each intake creates one `IntakeWorkspace` that contains:
- Uploaded documents (with original and worker-edited filenames)
- Worker-provided context (main context + timeline-specific details)
- AI-organized timeline events
- Document categories
- Intake summary narrative
- Organization notes
- Share/save/submit status

### 2. Worker-Side Responsibility

The worker-side app is the **creation and control layer**:
- Creates the initial intake workspace
- Uploads and renames files
- Adds context to timeline events
- Saves progress
- Controls sharing with participating firms
- Submits the intake only after explicit consent

### 3. AI Organization Intelligence

The AI reviews the **full intake workspace** together:
- File contents + original filenames + renamed filenames
- Worker-provided context across all timeline cards
- Additional notes and uploaded information
- Document relationships and timeline connections

This creates a **connected factual narrative** rather than isolated data points.

### 4. Firm-Side Access

When a worker submits an intake to participating firms:
- The intake workspace is marked as `submitted`
- Firms receive **read-only access** to the same workspace
- Firms see the AI-organized narrative built from worker inputs
- All worker context, document connections, and timeline details are preserved

## Data Flow

```
Worker Creates Intake
        ↓
IntakeWorkspace Created (unique ID)
        ↓
Worker Uploads Files → Updates workspace.documents[]
        ↓
Worker Renames Files → Updates document.workerEditedFileName
        ↓
Worker Adds Timeline Context → Updates workspace.workerContext.timelineContexts
        ↓
AI Organization Process → Generates workspace.intakeSummary, workspace.timelineEvents
        ↓
Worker Reviews Summary
        ↓
Worker Clicks "Share With Participating Firms"
        ↓
Intake Submitted → workspace.shareStatus = 'submitted', workspace.sharedWithFirms = true
        ↓
Firms Access Same Workspace (read-only) → Law Firm Dashboard displays submitted intakes
```

## Implementation

### Key Files

- **`/types/IntakeWorkspace.ts`** - Core data structure and helper functions
- **`/App.tsx`** - State management for current workspace and submitted intakes
- **`/screens/IntakeSummaryScreen.tsx`** - Worker save/submit actions
- **`/screens/LawFirmDashboardScreen.tsx`** - Firm-side intake display
- **`/screens/IntakeReviewScreen.tsx`** - Detailed firm-side review

### State Management (App.tsx)

```typescript
// Current intake workspace (worker is editing)
const [currentIntakeWorkspace, setCurrentIntakeWorkspace] = useState<IntakeWorkspace>(createEmptyIntakeWorkspace());

// Submitted intakes (available to firms)
const [submittedIntakes, setSubmittedIntakes] = useState<IntakeWorkspace[]>([]);

// Helper functions
updateCurrentIntake(updates) // Updates current workspace
saveIntakeWorkspace() // Marks workspace as saved
submitToFirms() // Submits workspace to participating firms
startNewIntake() // Creates new empty workspace
```

### Worker Actions

**Save Progress:**
```typescript
onSaveIntake() // Marks workspace.saveStatus = 'saved'
```

**Submit to Firms:**
```typescript
onSubmitToFirms() // Marks workspace as submitted, adds to submittedIntakes[]
```

### Firm Access

Firms receive `submittedIntakes[]` array containing all submitted `IntakeWorkspace` objects. Each workspace includes:
- Full AI-organized narrative
- Worker-provided context (preserved authentically)
- Document inventory with worker-edited filenames
- Timeline events with related documents
- Organization notes and workflow alerts

## Privacy & Control

- Workers control when intakes are shared
- Intakes are not visible to firms until explicitly submitted
- Workers can save progress without sharing
- Workers can download/email summaries without firm submission
- "Start Over" clears the current workspace but preserves submitted intakes

## Firm-Side Architecture

### Permission-Based Access

Participating firms have **read-only access** to the shared `IntakeWorkspace` with the ability to:
- View AI-organized intake narratives
- Review worker-provided context (preserved authentically)
- See timeline events with related documents
- Access document inventory with worker-edited filenames
- View organization notes and workflow alerts

Firms can also perform **workflow management actions** that update the shared workspace:
- Update workflow status (New, Under Review, Contacted, etc.)
- Add internal reviewer notes (private to firm, not visible to worker)
- Request additional information from worker
- Download intake summaries
- Archive or decline intakes

### Firm-Side Fields in IntakeWorkspace

```typescript
// Firm workflow management (attached to shared workspace)
workflowStatus: WorkflowStatus // 'new' | 'additional-docs' | 'ready-review' | 'under-review' | 'contacted' | 'archived' | 'declined'
internalReviewerNotes: InternalReviewerNote[] // Private - not visible to worker
additionalInfoRequests: AdditionalInfoRequest[]
routedToFirmIds: string[] // Which firms received this intake
```

### Privacy Boundaries

**Visible to Firms:**
- All worker-provided information (documents, context, timeline details)
- AI-organized narratives and summaries
- Document categories and relationships
- Organization notes and alerts

**Private to Firms (not visible to workers):**
- Internal reviewer notes
- Firm-specific workflow status changes
- Which other firms received the same intake
- Firm routing and preference matching details

**Visible to Workers (from firm actions):**
- Additional information requests (categories + optional note)
- General workflow status updates (if configured to share)

### Intake Routing Logic

When a worker clicks "Share With Participating Firms," the intake is routed using controlled matching:

```typescript
routeIntakeToEligibleFirms(intake, firmPreferences)
```

**Routing Criteria:**
1. **Geography Match**: Intake location/state matches firm's accepted states
2. **Category Match**: Reported concerns match firm's accepted categories
3. **Readiness Threshold**: Intake completeness meets firm's minimum requirements
   - `all`: Accept all intakes
   - `ready-only`: Timeline organized + 3+ documents
   - `complete-only`: Timeline organized + 5+ documents
4. **Active Status**: Firm is active and accepting new intakes

**Not a Mass Email**: Intakes only appear to firms that match all routing criteria.

### Firm Dashboard Display

The Law Firm Dashboard maps shared `IntakeWorkspace` objects to display format:

```typescript
// Transforms IntakeWorkspace → IntakeSubmission (view layer)
intakesFromWorkspaces = submittedIntakes.map(workspace => ({
  id: workspace.id,
  readiness: calculateReadiness(workspace),
  categories: workspace.reportedConcerns,
  documentCount: workspace.documents.length,
  summary: workspace.intakeSummary?.overview || generateFallback(workspace),
  // ... other display fields
}))
```

This ensures firms always see the same AI-organized intelligence that was created from the worker's inputs.

### Workflow Actions

**Update Status:**
```typescript
updateWorkflowStatus(workspace, 'under-review')
```

**Add Internal Note (Private):**
```typescript
addInternalReviewerNote(workspace, content, reviewer, firmId)
```

**Request Additional Info (Visible to Worker):**
```typescript
requestAdditionalInfo(workspace, categories, note, firmId)
```

### Data Flow (Firm Side)

```
Worker Submits Intake
        ↓
Routing Logic Evaluates Firm Preferences
        ↓
Eligible Firms Determined (geography + category + readiness match)
        ↓
Intake Appears in Eligible Firm Dashboards
        ↓
Firm Reviews AI-Organized Narrative
        ↓
Firm Updates Workflow Status → Updates shared workspace
        ↓
Firm Adds Internal Note → Private, attached to workspace
        ↓
Firm Requests Additional Info → Worker can see request in their workspace
```

## Future Enhancements

- Backend persistence (currently in-memory state)
- Real-time intake status updates and notifications
- Intake versioning for worker updates after submission
- Advanced routing rules (firm capacity, specialization scoring)
- Analytics dashboard for routing effectiveness
- Multi-firm collaboration on same intake (with proper consent)
