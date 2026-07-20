import { useState, useEffect, useMemo } from 'react';
import { OneThreeSevenLoader } from '../components/ui/OneThreeSevenLoader';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  FileText,
  Calendar,
  MapPin,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Settings,
  LogOut,
  Loader2,
} from 'lucide-react';
import { Screen } from '../App';
import {
  IntakeWorkspace,
  WorkflowStatus,
  updateWorkflowStatus,
  addInternalReviewerNote,
} from '../types/IntakeWorkspace';

import type { FirmLiveIntakeView } from '../../services/intakeDataService';
import { downloadFirmIntakeReviewDocument, resolveWageExposure } from '../../services/firmIntakeSummaryDownload';
import { triggerIntakeFactExtraction } from '../../services/documentFactsService';
import type { SourceCitation } from '../../services/damagesCalculator';
import { CitationPanel } from '../components/CitationPanel';
import { WageExposureReviewSection } from '../components/WageExposureReviewSection';
import {
  createFirmIntakeFileSignedUrl,
  FIRM_ADDITIONAL_DOCUMENT_CATEGORIES,
  inferCategoryFromFileName,
  sanitizeFirmFacingText,
  recordFirmRouteEvent,
} from '../../services/intakeDataService';
import type { FirmAccessibleUploadFile } from '../../services/intakeDataService';
import {
  ONE3SEVEN_NOTICES,
  SAMPLE_INTAKE_NUMBER,
  SAMPLE_INTAKE_PREVIEW_DISPLAY_LABEL,
  WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED,
  formatRouteStatusForFirm,
  isWorkerUploadedAdditionalDocumentsWorkflow,
} from '../constants/one3sevenProduct';
import { NotificationsBell } from '../components/NotificationsBell';
import type { AppNotificationItem } from '../components/NotificationsBell';
import {
  buildFirmIntakeOverviewFields,
  buildFirmWorkerStoryDisplay,
  firmPersistedWorkflowToneClass,
  groupRecordCategoriesForFirmDisplay,
  partitionFirmReadinessPresentation,
  polishFirmFacingProse,
  polishHumanReadableDisplayText,
  polishMissingContextLine,
  polishNameForDisplay,
  polishTimelineEventSummary,
  polishTimelineEventTitle,
  resolveEventDisplayCategory,
  resolveFirmPersistedWorkflowStatus,
  type FirmPersistedWorkflowTone,
} from '../../services/firmIntakeDisplay';
import { FirmExpandableSection } from '../components/FirmExpandableSection';
import { FirmCollapsibleText } from '../components/FirmCollapsibleText';
import { FirmTimelineEventCard } from '../components/FirmTimelineEventCard';
import { FIRM_REVIEW_SECTION } from '../constants/firmIntakePresentation';
import { EmploymentMatterChipList } from '../components/EmploymentMatterTagsLine';
import { WordMark } from '../components/WordMark';

interface IntakeReviewScreenProps {
  onNavigate: (screen: Screen) => void;
  intakeId: string;
  intakeWorkspace?: IntakeWorkspace;
  onUpdateWorkspace: (updates: Partial<IntakeWorkspace>) => void;
  firmLiveView?: FirmLiveIntakeView | null;
  firmLiveViewLoading?: boolean;
  onRequestFullAccess?: () => Promise<{ error?: string }>;
  onOpenFirmSettings?: () => void;
  onFirmSignOut?: () => void;
  firmDisplayName?: string;
  firmBellNotifications?: AppNotificationItem[];
  onAcceptIntake?: () => Promise<{ error?: string }>;
  onDeclineIntake?: () => Promise<{ error?: string }>;
  onRequestAdditionalDocuments?: (payload: {
    intakeId: string;
    categories: string[];
    noteToWorker: string;
  }) => Promise<{ error?: string }>;
  onReloadFirmLiveView?: () => void | Promise<void>;
  /** Strips nav chrome down to a single slim bar — used for the public demo link. */
  demoMode?: boolean;
}

interface TimelineEvent {
  date: string;
  event: string;
  category: string;
  summary: string;
  relatedDocs: number;
  directFileLabels?: string[];
}

type FirmDocumentEntry = {
  label: string;
  uploadedFileId?: string;
  filePath?: string;
};

interface DocumentCategory {
  name: string;
  count: number;
  documents: FirmDocumentEntry[];
}

const FIRM_REVIEW_PAGE = 'min-h-screen bg-[#FAF9F6] text-[#1B2623]';
const FIRM_REVIEW_NAV = 'sticky top-0 z-50 border-b border-[#E4E5DE] bg-white/90 backdrop-blur';
const FIRM_REVIEW_PROMINENT_CARD =
  'rounded-[28px] border border-[#E4E5DE] bg-white/95 p-6 shadow-[0_28px_90px_rgba(31,27,75,0.12)] sm:p-8';
const FIRM_REVIEW_CARD =
  'rounded-[24px] border border-[#E4E5DE] bg-white/92 p-5 shadow-[0_18px_56px_rgba(31,27,75,0.09)]';
const FIRM_REVIEW_QUIET_CARD =
  'rounded-[20px] border border-[#E4E5DE] bg-white/70 p-4 shadow-[0_10px_30px_rgba(31,27,75,0.05)]';
const FIRM_REVIEW_PRIMARY_BUTTON =
  'bg-[#42574E] text-white shadow-[0_14px_34px_rgba(66,87,78,0.24)] hover:bg-[#42574E]';
const FIRM_REVIEW_SECONDARY_BUTTON =
  'border border-[#E4E5DE] bg-white text-[#1B2623] shadow-sm hover:border-[#7C8B6F] hover:bg-[#F2F4EC]';

function firmDocumentEntryKey(entry: FirmDocumentEntry): string {
  return entry.uploadedFileId ?? entry.label;
}

// Mock data
const mockTimelineEvents: TimelineEvent[] = [
  {
    date: '2025-01-15',
    event: 'Employment Start',
    category: 'Employment Status',
    summary: 'Worker began employment as delivery driver',
    relatedDocs: 2,
  },
  {
    date: '2025-08-22',
    event: 'Overtime Hours Worked',
    category: 'Overtime',
    summary: 'Multiple weeks with hours exceeding 40 per week documented in timecards',
    relatedDocs: 4,
  },
  {
    date: '2025-11-03',
    event: 'Meal Period Concerns',
    category: 'Meal & Rest Periods',
    summary: 'Communications indicate shortened or missed meal periods during shifts',
    relatedDocs: 3,
  },
  {
    date: '2026-03-10',
    event: 'Employment End',
    category: 'Final Pay',
    summary: 'Final paycheck received with potential outstanding overtime',
    relatedDocs: 3,
  },
];

function buildDocCategoriesFromFiles(
  files: FirmAccessibleUploadFile[],
  _previewOnly: boolean
): DocumentCategory[] {
  const map = new Map<string, FirmDocumentEntry[]>();
  for (const f of files) {
    const c = f.category || 'Uncategorized';
    if (!map.has(c)) map.set(c, []);
    const list = map.get(c)!;
    if (list.length < 12) {
      list.push({
        label: sanitizeFirmFacingText(f.file_name) || 'Uploaded file',
        uploadedFileId: f.uploaded_file_id,
        filePath: f.file_path,
      });
    }
  }
  return [...map.entries()].map(([name, documents]) => ({ name, count: documents.length, documents }));
}

const mockDocumentCategories: DocumentCategory[] = [
  {
    name: 'Pay Records',
    count: 5,
    documents: [
      { label: 'Feb 2025 Paystub.pdf' },
      { label: 'March 1-15 Pay.pdf' },
      { label: 'March 16-31 Paystub.pdf' },
      { label: 'April Pay Record.pdf' },
      { label: 'Final Paycheck May.pdf' },
    ],
  },
  {
    name: 'Time Records',
    count: 4,
    documents: [
      { label: 'Timecard Feb Week 1.pdf' },
      { label: 'Timecard Feb Week 3.pdf' },
      { label: 'March Hours Log.pdf' },
      { label: 'April Timesheet.pdf' },
    ],
  },
  {
    name: 'Workplace Communications',
    count: 3,
    documents: [
      { label: 'Manager Email - Scheduling.pdf' },
      { label: 'Meal Break Discussion.pdf' },
      { label: 'Shift Coverage Text.pdf' },
    ],
  },
];

function buildDocCategoriesFromWorkspaceDocuments(ws: IntakeWorkspace | undefined): DocumentCategory[] {
  if (!ws?.documents?.length) return [];
  const files: FirmAccessibleUploadFile[] = ws.documents.map((d) => ({
    file_name: d.workerEditedFileName || d.originalFileName,
    category: d.category?.trim() || inferCategoryFromFileName(d.originalFileName),
  }));
  return buildDocCategoriesFromFiles(files, false);
}

function mapWorkspaceTimelineForReview(ws: IntakeWorkspace | undefined): TimelineEvent[] {
  if (!ws?.timelineEvents?.length) return [];
  return ws.timelineEvents.map((t) => ({
    date: t.date,
    event: t.event,
    category: t.category,
    summary: t.summary,
    relatedDocs: t.relatedDocs,
  }));
}

export function IntakeReviewScreen({
  onNavigate,
  intakeId,
  intakeWorkspace,
  onUpdateWorkspace,
  firmLiveView,
  firmLiveViewLoading = false,
  onRequestFullAccess,
  onOpenFirmSettings,
  onFirmSignOut,
  firmDisplayName,
  firmBellNotifications = [],
  onAcceptIntake,
  onDeclineIntake,
  onRequestAdditionalDocuments,
  onReloadFirmLiveView,
  demoMode = false,
}: IntakeReviewScreenProps) {
  // Use workspace data if available, otherwise fall back to mock
  const rawWorkflow = (intakeWorkspace?.workflowStatus as string | undefined) ?? 'new';
  const currentWorkflowStatus: WorkflowStatus =
    rawWorkflow === 'declined' ? 'not-pursuing' : (rawWorkflow as WorkflowStatus);
  const savedNotes = intakeWorkspace?.internalReviewerNotes || [];

  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(currentWorkflowStatus);
  const [internalNotes, setInternalNotes] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showFirmDocRequestModal, setShowFirmDocRequestModal] = useState(false);
  const [docReqCategories, setDocReqCategories] = useState<string[]>([]);
  const [docReqNote, setDocReqNote] = useState('');
  const [docReqSubmitting, setDocReqSubmitting] = useState(false);
  const [docReqError, setDocReqError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [extractionRunning, setExtractionRunning] = useState(false);
  const [extractionDone, setExtractionDone] = useState(false);
  const [firmFileOpeningKey, setFirmFileOpeningKey] = useState<string | null>(null);
  const [firmFileOpenError, setFirmFileOpenError] = useState<string | null>(null);
  const [showDeclineConfirm, setShowDeclineConfirm] = useState(false);
  const [declineSubmitting, setDeclineSubmitting] = useState(false);

  // Section 8B wage-exposure estimate (firm/full-access only; fully guarded upstream).
  const wageExposure = useMemo(
    () => (firmLiveView ? resolveWageExposure(firmLiveView) : null),
    [firmLiveView],
  );
  const [openCitation, setOpenCitation] = useState<SourceCitation | null>(null);
  const [citationUrls, setCitationUrls] = useState<Record<string, string>>({});

  // Pre-generate 3600s signed URLs for the documents cited by the wage estimate, so the
  // CitationPanel opens with no round-trip. Full-access only (storage RLS enforces it too).
  useEffect(() => {
    if (!wageExposure || !firmLiveView || firmLiveView.previewOnly) {
      setCitationUrls({});
      return;
    }
    const r = wageExposure.report;
    const docIds = new Set<string>();
    for (const li of [r.baseHourlyRate, r.overtimeHoursUnderpaid, r.mealBreaksMissed]) {
      if (li?.citation?.docId) docIds.add(li.citation.docId);
    }
    if (docIds.size === 0) {
      setCitationUrls({});
      return;
    }
    const pathById = new Map<string, string>();
    for (const f of firmLiveView.files) {
      if (f.uploaded_file_id && f.file_path) pathById.set(f.uploaded_file_id, f.file_path);
    }
    let cancelled = false;
    void (async () => {
      const entries: Record<string, string> = {};
      for (const id of docIds) {
        const path = pathById.get(id);
        if (!path) continue;
        const res = await createFirmIntakeFileSignedUrl(path, 3600);
        if (res.url) entries[id] = res.url;
      }
      if (!cancelled) setCitationUrls(entries);
    })();
    return () => {
      cancelled = true;
    };
  }, [wageExposure, firmLiveView]);

  // Scroll to top when component mounts — wrapped defensively for iOS Safari
  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      try { window.scrollTo(0, 0); } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    const raw = (intakeWorkspace?.workflowStatus as string | undefined) ?? 'new';
    setWorkflowStatus(raw === 'declined' ? 'not-pursuing' : (raw as WorkflowStatus));
  }, [intakeWorkspace?.workflowStatus]);

  // Mark extraction as done if intelligence already exists from a previous run
  useEffect(() => {
    if (firmLiveView?.intelligence) setExtractionDone(true);
  }, [firmLiveView?.intelligence]);

  // ── Event: firm_first_opened_at ──────────────────────────────────────────
  // Fire once when the firm first opens this intake. The service function
  // guards the write with .is('firm_first_opened_at', null) so return visits
  // are a no-op. Skip demo mode — no real DB row exists.
  useEffect(() => {
    const routeId = firmLiveView?.routeId;
    if (routeId && !demoMode) {
      void recordFirmRouteEvent(routeId, 'first_opened');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmLiveView?.routeId]);

  // Auto-trigger AI extraction silently when full-access intake loads without intelligence
  useEffect(() => {
    if (
      firmLiveView?.routeStatus === 'full_access' &&
      !firmLiveView.intelligence &&
      !extractionRunning &&
      !extractionDone &&
      intakeId
    ) {
      void handleRunAiExtraction(true); // silent — no toast
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmLiveView?.routeStatus, intakeId]);

  const firmReadinessPresentation = partitionFirmReadinessPresentation(firmLiveView?.readiness ?? []);

  const preferConnectedLiveIntake = Boolean(firmLiveView || onRequestFullAccess);

  const mapEventsToTimeline = (v: FirmLiveIntakeView) => {
    // Build a normalized set of all file names for fast lookup
    const allFiles = v.files.map((f) => f.file_name || '');

    // Extract filenames mentioned in ai_summary ("Supported by X.pdf, Y.pdf")
    // Returns both count and the matched display labels
    const extractMentionedFiles = (summary: string): { count: number; labels: string[] } => {
      const supportedBy = summary.match(/[Ss]upported by\s+(.+?)(?:\.\s+[A-Z]|\.$|$)/);
      if (!supportedBy?.[1]) return { count: 0, labels: [] };
      const mentioned = supportedBy[1]
        .split(/,\s*/)
        .map((s) => s.trim())
        .filter(Boolean);
      const matched: string[] = [];
      for (const m of mentioned) {
        const mNorm = m.toLowerCase().replace(/\s+/g, '_').replace(/\.pdf$/i, '');
        const found = allFiles.find((fn) => {
          const fnNorm = fn.toLowerCase().replace(/\.pdf$/i, '');
          return fnNorm === mNorm || fnNorm.includes(mNorm) || mNorm.includes(fnNorm);
        });
        if (found) matched.push(found);
        else if (m.match(/\.(pdf|doc|docx|png|jpg)/i)) matched.push(m); // keep as-is if looks like a file
      }
      return { count: matched.length, labels: matched };
    };

    // Sanitize and correct event titles (same logic as PDF builder)
    const sanitizeAndCorrectTitle = (raw: string, category: string): string => {
      const cleaned = raw
        // strip bare email addresses (with or without wrapping parens)
        .replace(/\s*\([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^)]*\)?/g, '')
        .replace(/\s+[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
        .replace(/\bFROM:\s*\S+/gi, '')
        .replace(/\bTO:\s*\S+/gi, '')
        .replace(/\bSUBJECT:\s*/gi, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      // Correct "Schedule change" when category says it's a meal/rest event
      const cat = (category || '').toLowerCase();
      if (/schedule change/i.test(cleaned) && /meal|rest period/i.test(cat)) {
        return 'Meal-break and timekeeping records documented';
      }
      return cleaned;
    };

    return v.events.map((e) => {
      const storedCategory = e.category || 'Uncategorized';
      const rawTitle = polishTimelineEventTitle(e.title);
      const resolvedTitle = sanitizeAndCorrectTitle(rawTitle, storedCategory);
      const resolvedCategory = resolveEventDisplayCategory(storedCategory, resolvedTitle);

      // Count only files directly named in the summary — not all files in the category
      const { count: directCount, labels: directLabels } = extractMentionedFiles(e.ai_summary);

      // Fallback: if no "Supported by" text, count category matches (old behavior)
      const docsByCategory = new Map<string, number>();
      const labelsByCategory = new Map<string, string[]>();
      for (const f of v.files) {
        const c = f.category || 'Uncategorized';
        docsByCategory.set(c, (docsByCategory.get(c) ?? 0) + 1);
        labelsByCategory.set(c, [...(labelsByCategory.get(c) ?? []), f.file_name || '']);
      }
      const categoryCount = docsByCategory.get(storedCategory) ?? 0;
      const categoryLabels = labelsByCategory.get(storedCategory) ?? [];

      // Use direct mention count when the summary has explicit references; else use category
      const relatedDocs = directCount > 0 ? directCount : categoryCount;
      const directFileLabels = directCount > 0 ? directLabels : categoryLabels;

      return {
        date: e.event_date,
        event: resolvedTitle,
        category: resolvedCategory,
        summary: polishTimelineEventSummary(e.ai_summary),
        relatedDocs,
        directFileLabels,
      };
    });
  };

  const timelineForDisplay: TimelineEvent[] = (() => {
    if (preferConnectedLiveIntake) {
      if (firmLiveViewLoading) return [];
      if (firmLiveView?.events?.length) return mapEventsToTimeline(firmLiveView);
      return [];
    }
    if (firmLiveView?.events?.length) return mapEventsToTimeline(firmLiveView);
    const wsTimeline = mapWorkspaceTimelineForReview(intakeWorkspace);
    if (wsTimeline.length) return wsTimeline;
    return mockTimelineEvents;
  })();

  const documentCategoriesForDisplay = (() => {
    if (preferConnectedLiveIntake) {
      if (firmLiveViewLoading) return [];
      if (firmLiveView) return buildDocCategoriesFromFiles(firmLiveView.files, firmLiveView.previewOnly);
      return [];
    }
    if (firmLiveView) return buildDocCategoriesFromFiles(firmLiveView.files, firmLiveView.previewOnly);
    const fromWs = buildDocCategoriesFromWorkspaceDocuments(intakeWorkspace);
    if (fromWs.length) return fromWs;
    return mockDocumentCategories;
  })();

  const liveTimelineEmptyMessage =
    'No timeline events are available for this intake yet. Records may still be organizing, or your preview access may be limited until full access is approved.';
  const liveDocumentsEmptyMessage =
    'No documents are listed for this intake yet. Files appear here after uploads are organized and you have the appropriate review access.';

  const useConnectedFirmLayout = Boolean(firmLiveView);

  const firmOverviewFields =
    firmLiveView && useConnectedFirmLayout ? buildFirmIntakeOverviewFields(firmLiveView) : [];

  const firmWorkerStoryDisplay =
    firmLiveView && useConnectedFirmLayout ? buildFirmWorkerStoryDisplay(firmLiveView) : '';

  const firmRecordGroups =
    documentCategoriesForDisplay.length > 0
      ? groupRecordCategoriesForFirmDisplay(
          documentCategoriesForDisplay.map((c) => ({ name: c.name, count: c.count }))
        )
      : [];

  const relatedDocLabelsForCategory = (category: string) => {
    if (!firmLiveView?.files?.length) return [];
    return firmLiveView.files
      .filter((f) => (f.category || 'Uncategorized') === (category || 'Uncategorized'))
      .map((f) => sanitizeFirmFacingText(f.file_name) || 'Uploaded file');
  };
  const firmRouteStatus = firmLiveView?.routeStatus ?? null;

  const canOpenFirmFile = (entry: FirmDocumentEntry) =>
    firmRouteStatus === 'full_access' &&
    !firmLiveView?.previewOnly &&
    Boolean(entry.filePath?.trim());

  const handleFirmViewFile = async (entry: FirmDocumentEntry) => {
    if (!canOpenFirmFile(entry) || !entry.filePath) return;
    const key = firmDocumentEntryKey(entry);
    setFirmFileOpeningKey(key);
    setFirmFileOpenError(null);
    const res = await createFirmIntakeFileSignedUrl(entry.filePath);
    if (res.error || !res.url) {
      setFirmFileOpenError(res.error ?? 'Could not open this file.');
      setFirmFileOpeningKey(null);
      return;
    }
    window.open(res.url, '_blank', 'noopener,noreferrer');
    setFirmFileOpeningKey(null);
  };

  const firmReviewSteps = [
    { key: 'preview_sent', label: 'Preview received' },
    { key: 'access_requested', label: 'Full access requested' },
    { key: 'full_access', label: 'Participating firm review' },
    { key: 'accepted', label: 'Intake added to review queue' },
  ];
  const isFirmAccepted =
    (firmLiveView?.intakeWorkflowStatus ?? '').trim().toLowerCase() === 'accepted by firm';
  const isFirmDeclined =
    (firmLiveView?.intakeWorkflowStatus ?? '').trim().toLowerCase() === 'not pursuing';
  const activeFirmStepIndex =
    isFirmAccepted || firmRouteStatus === 'accepted'
      ? 3
      : firmRouteStatus === 'full_access'
        ? 2
        : firmRouteStatus === 'access_requested'
          ? 1
          : 0;

  const isSampleFirmIntakeIdentifier =
    intakeId === 'sample-137-demo' || firmLiveView?.intakeNumber === SAMPLE_INTAKE_NUMBER;

  const isSampleFirmIntakePreview = Boolean(firmLiveView && isSampleFirmIntakeIdentifier);
  const intakeReviewReferenceLabel = isSampleFirmIntakeIdentifier
    ? SAMPLE_INTAKE_PREVIEW_DISPLAY_LABEL
    : `ID: ${intakeId}`;

  // EEOC / SOL deadline — computed at component level so nav bar can show it on desktop
  const navSolData = (() => {
    const intel = firmLiveView?.intelligence;
    if (!intel) return null;
    const solDateStr = intel.confirmedTerminationDate || intel.confirmedComplaintDate;
    if (!solDateStr) return null;
    const parsed = new Date(solDateStr);
    if (isNaN(parsed.getTime())) return null;
    const today = new Date();
    const elapsed = Math.floor((today.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
    const remaining = 180 - elapsed;
    return { elapsed, remaining, fromTermination: !!intel.confirmedTerminationDate };
  })();

  if (preferConnectedLiveIntake && firmLiveViewLoading) {
    return (
      <div className={FIRM_REVIEW_PAGE}>
        <nav className={FIRM_REVIEW_NAV}>
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('firmDashboard')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1B2623]/65 transition-colors hover:bg-[#F2F4EC] hover:text-[#1B2623]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-[#1B2623]">Intake Review</h1>
                <p className="text-xs text-[#1B2623]/52">{intakeReviewReferenceLabel}</p>
              </div>
            </div>
          </div>
        </nav>
        <div className="flex flex-col items-center justify-center py-20 px-6">
          <OneThreeSevenLoader size="lg" />
        </div>
      </div>
    );
  }

  if (preferConnectedLiveIntake && !firmLiveViewLoading && !firmLiveView) {
    return (
      <div className={FIRM_REVIEW_PAGE}>
        <nav className={FIRM_REVIEW_NAV}>
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('firmDashboard')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1B2623]/65 transition-colors hover:bg-[#F2F4EC] hover:text-[#1B2623]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-[#1B2623]">Intake Review</h1>
                <p className="text-xs text-[#1B2623]/52">{intakeReviewReferenceLabel}</p>
              </div>
            </div>
          </div>
        </nav>
        <div className="max-w-lg mx-auto px-6 py-16 text-center">
          <p className="text-sm text-[#1B2623] mb-2">This intake preview could not be loaded.</p>
          <p className="text-xs text-[#6A6D66] leading-relaxed mb-6">
            Return to your dashboard and open the intake again. If the issue continues, confirm your session is still active.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('firmDashboard')}
            className={`rounded-full px-5 py-2.5 text-sm font-medium ${FIRM_REVIEW_PRIMARY_BUTTON}`}
          >
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const getStatusLabel = (status: WorkflowStatus) => {
    switch (status) {
      case 'new':
        return 'New intake';
      case 'additional-docs':
        return 'Additional records requested';
      case 'ready-review':
        return 'Ready for firm review';
      case 'under-review':
        return 'Under Review';
      case 'contacted':
        return 'Follow-up in progress';
      case 'archived':
        return 'Archived in this workspace';
      case 'not-pursuing':
        return 'Not advancing this intake here';
    }
  };

  const handleDownloadSummary = async () => {
    if (!firmLiveView) {
      showToastMessage('Load an intake before downloading the review packet.');
      return;
    }
    try {
      await downloadFirmIntakeReviewDocument(firmLiveView);
      showToastMessage('Firm intake review packet downloaded.');
    } catch {
      showToastMessage('Could not generate the review packet. Try again.');
    }
  };

  const handleRunAiExtraction = async (silent = false) => {
    if (!intakeId) return;
    setExtractionRunning(true);
    if (!silent) showToastMessage('Running AI extraction — processing all documents…');

    // Failsafe timeout: abort after 3 minutes
    const timeoutId = setTimeout(() => {
      setExtractionRunning(false);
      showToastMessage('Extraction timed out. Some documents may not have been processed. Try again.');
    }, 180_000);

    try {
      const result = await triggerIntakeFactExtraction(intakeId);

      clearTimeout(timeoutId);

      if ((result.errors?.length ?? 0) > 0 && result.triggered === 0) {
        // Total failure
        showToastMessage(`Extraction failed: ${result.errors?.[0] ?? 'Unknown error'}`);
        setExtractionRunning(false);
        return;
      }

      setExtractionDone(true);

      const errCount = result.errors?.length ?? 0;
      const summary = result.triggered > 0
        ? `AI extraction complete — ${result.triggered} document${result.triggered === 1 ? '' : 's'} processed.${errCount ? ` ${errCount} failed.` : ''}`
        : 'All documents already extracted.';
      showToastMessage(summary);

      if (onReloadFirmLiveView) await onReloadFirmLiveView();
    } catch (e: any) {
      clearTimeout(timeoutId);
      showToastMessage(`Extraction failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setExtractionRunning(false);
    }
  };

  const showToastMessage = (message: string, durationMs = 5000) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), durationMs);
  };

  const handleUpdateStatus = (status: WorkflowStatus) => {
    setWorkflowStatus(status);
    setShowStatusModal(false);

    if (intakeWorkspace) {
      const updated = updateWorkflowStatus(intakeWorkspace, status);
      onUpdateWorkspace(updated);
    }

    showToastMessage('Demo workspace status updated (not saved to live intakes).');
  };

  const handleSaveNotes = () => {
    if (internalNotes.trim() && intakeWorkspace) {
      // Add note to shared workspace (private to firm)
      const updated = addInternalReviewerNote(
        intakeWorkspace,
        internalNotes,
        'JS', // In production, this would be the current user
        'firm-001' // In production, this would be the current firm ID
      );
      onUpdateWorkspace(updated);
      setInternalNotes('');
      showToastMessage('Reviewer note saved.');
    }
  };

  const toggleDocReqCategory = (category: string) => {
    setDocReqError(null);
    setDocReqCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const openFirmDocRequestModal = () => {
    setDocReqCategories([]);
    setDocReqNote('');
    setDocReqError(null);
    setShowFirmDocRequestModal(true);
  };

  const closeFirmDocRequestModal = () => {
    if (docReqSubmitting) return;
    setShowFirmDocRequestModal(false);
    setDocReqCategories([]);
    setDocReqNote('');
    setDocReqError(null);
  };

  const handleSubmitDocumentRequest = async () => {
    if (!onRequestAdditionalDocuments) return;
    if (docReqCategories.length === 0) {
      setDocReqError('Select at least one document category.');
      return;
    }
    setDocReqError(null);
    setDocReqSubmitting(true);
    try {
      const result = await onRequestAdditionalDocuments({
        intakeId,
        categories: docReqCategories,
        noteToWorker: docReqNote.trim(),
      });
      if (result?.error) {
        setDocReqError(result.error);
        return;
      }
      closeFirmDocRequestModal();
      showToastMessage('Additional document request sent.');
    } finally {
      setDocReqSubmitting(false);
    }
  };

  const handleAcceptIntake = async () => {
    if (!onAcceptIntake) return;
    const result = await onAcceptIntake();
    if (result.error) {
      showToastMessage(`Could not accept intake: ${result.error}`);
      return;
    }
    // Record firm_accepted_at (one-time write, no-op on re-accept or demo)
    const routeId = firmLiveView?.routeId;
    if (routeId && !demoMode) void recordFirmRouteEvent(routeId, 'accepted');
    showToastMessage('Intake added for follow-up. It will stay in your review queue.');
  };

  const handleDeclineIntake = async () => {
    if (!onDeclineIntake) return;
    setDeclineSubmitting(true);
    try {
      const result = await onDeclineIntake();
      if (result.error) {
        showToastMessage(`Could not update status: ${result.error}`);
        return;
      }
      // Record firm_declined_at (one-time write, no-op on demo)
      const routeId = firmLiveView?.routeId;
      if (routeId && !demoMode) void recordFirmRouteEvent(routeId, 'declined');
      setShowDeclineConfirm(false);
      showToastMessage('Marked as not pursuing. The intake remains in your queue for reference.');
    } finally {
      setDeclineSubmitting(false);
    }
  };

  const reconstructedRecordCount = firmLiveView?.files.length ?? documentCategoriesForDisplay.reduce((n, c) => n + c.count, 0);
  const chronologyReviewHints = [
    ...(firmLiveView?.missing ?? []),
    ...firmReadinessPresentation.additionalContext,
  ];
  const workerSaidNoReimburse =
    firmLiveView?.workerFollowUp?.reimbursed === 'no' ||
    firmLiveView?.workerFollowUp?.workedRemotely === 'no';
  const chronologyGapLines =
    chronologyReviewHints.length > 0
      ? Array.from(
          new Set(
            chronologyReviewHints
              .map((line) => polishMissingContextLine(line))
              .filter(Boolean)
              .filter((line) => {
                // Drop reimbursement suggestion if worker explicitly said no
                if (workerSaidNoReimburse && /reimburse/i.test(line)) return false;
                return true;
              })
          )
        ).slice(0, 5)
      : [];

  const intelligenceConfirmCount =
    firmLiveView?.intelligence?.confirmationNeeded?.length ?? 0;
  const confirmationDisplayCount =
    intelligenceConfirmCount > 0 ? intelligenceConfirmCount : chronologyGapLines.length;

  const usesPersistedWorkflowStatus = Boolean(firmLiveView && preferConnectedLiveIntake);
  const usesLocalWorkspaceWorkflow = !usesPersistedWorkflowStatus && Boolean(intakeWorkspace);

  const mapLocalWorkflowTone = (status: WorkflowStatus): FirmPersistedWorkflowTone => {
    if (status === 'under-review' || status === 'ready-review' || status === 'contacted') return 'active';
    if (status === 'additional-docs') return 'warning';
    if (status === 'archived' || status === 'not-pursuing') return 'muted';
    return 'neutral';
  };

  const workflowPresentation = usesPersistedWorkflowStatus
    ? resolveFirmPersistedWorkflowStatus({
        intakeWorkflowStatus: firmLiveView!.intakeWorkflowStatus,
        routeStatus: firmLiveView!.routeStatus,
        documentResponse: firmLiveView!.documentResponse,
        isSamplePreview: isSampleFirmIntakePreview,
      })
    : {
        label: getStatusLabel(workflowStatus),
        tone: mapLocalWorkflowTone(workflowStatus),
        source: 'workspace' as const,
      };

  const canEditLocalWorkflow = usesLocalWorkspaceWorkflow && !isSampleFirmIntakePreview;

  const persistedWorkflow = (firmLiveView?.intakeWorkflowStatus ?? '').trim();
  const docRequestActive =
    persistedWorkflow === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED ||
    persistedWorkflow === 'Additional Documents Requested';
  const docResponseComplete =
    isWorkerUploadedAdditionalDocumentsWorkflow(persistedWorkflow) ||
    Boolean(firmLiveView?.documentResponse?.fulfilled?.length);

  const chronologySteps = [
    'Timeline reconstructed',
    firmRouteStatus === 'preview_sent' ? 'Preview received' : 'Preview received',
    firmRouteStatus === 'access_requested' ? 'Review access requested' : 'Review access requested',
    firmRouteStatus === 'full_access' || firmRouteStatus === 'accepted'
      ? 'Worker approved access'
      : 'Worker approval pending',
    docRequestActive || (!usesPersistedWorkflowStatus && workflowStatus === 'additional-docs')
      ? 'Additional documents requested'
      : docResponseComplete || firmLiveView?.documentResponse
        ? 'Additional documents received'
        : workflowStatus === 'under-review' || isFirmAccepted || firmRouteStatus === 'accepted'
          ? 'Attorney review in progress'
          : 'Awaiting review',
  ];

  return (
    <div className={FIRM_REVIEW_PAGE}>
      {/* Top Navigation — slim bar in demo mode, full chrome otherwise */}
      {demoMode ? (
        <nav className="sticky top-0 z-50 border-b border-[#E4E5DE] bg-white/95 backdrop-blur">
          <div className="flex items-center justify-between px-5 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-semibold text-[#1B2623]"><WordMark /></span>
              <span className="hidden sm:inline text-[#E4E5DE]">·</span>
              <span className="hidden sm:inline text-xs text-[#1B2623]/50">Firm intake review</span>
            </div>
            <div className="flex items-center gap-2.5">
              {/* Desktop quick actions — always accessible without scrolling */}
              {navSolData && navSolData.elapsed >= 120 && (
                <span className={`hidden lg:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold border ${
                  navSolData.remaining <= 0 ? 'bg-red-50 text-red-700 border-red-200' :
                  navSolData.remaining <= 14 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                  'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  ⚠ Filing dates
                </span>
              )}
              <button
                onClick={handleDownloadSummary}
                className="hidden lg:flex items-center gap-1.5 rounded-full bg-[#42574E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#42574E] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <span className="rounded-full border border-[#E4E5DE] bg-[#F2F4EC] px-3 py-1 text-[11px] font-medium text-[#42574E]">
                Sample intake
              </span>
            </div>
          </div>
        </nav>
      ) : (
        <nav className={FIRM_REVIEW_NAV}>
          <div className="px-6 py-5">
            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onNavigate('firmDashboard')}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1B2623]/65 transition-colors hover:bg-[#F2F4EC] hover:text-[#1B2623]"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Review Queue
              </button>
              <div className="hidden h-6 w-px bg-[#E4E5DE] sm:block" />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-semibold text-[#1B2623]">Intake Review</h1>
                <p className="text-xs text-[#1B2623]/52">{intakeReviewReferenceLabel}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto sm:justify-end">
                {/* Desktop quick actions */}
                {navSolData && navSolData.elapsed >= 120 && (
                  <span className={`hidden lg:inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold border ${
                    navSolData.remaining <= 0 ? 'bg-red-50 text-red-700 border-red-200' :
                    navSolData.remaining <= 14 ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    ⚠ Filing dates
                  </span>
                )}
                <button
                  onClick={handleDownloadSummary}
                  className="hidden lg:flex items-center gap-1.5 rounded-full bg-[#42574E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#42574E] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <NotificationsBell items={firmBellNotifications} />
                {onOpenFirmSettings ? (
                  <button
                    type="button"
                    onClick={onOpenFirmSettings}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1B2623]/65 hover:bg-[#F2F4EC] hover:text-[#1B2623]"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>
                ) : null}
                {onFirmSignOut ? (
                  <button
                    type="button"
                    onClick={onFirmSignOut}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#1B2623]/52 hover:bg-[#F2F4EC] hover:text-[#1B2623]"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </nav>
      )}

      {firmLiveView && !demoMode ? (
        <div
          className="border-b border-[#E4E5DE] bg-white/82"
        >
          <div
            className="flex flex-wrap items-center gap-3 px-6 py-3 text-sm text-[#1B2623]/65"
          >
            <span>
              <strong>Access:</strong>{' '}
              {formatRouteStatusForFirm(firmLiveView.routeStatus, firmLiveView.isFirmCodeIntake)}
            </span>
            {firmLiveView.intakeNumber ? (
              isSampleFirmIntakeIdentifier ? (
                <span className="text-xs font-medium text-amber-950">{SAMPLE_INTAKE_PREVIEW_DISPLAY_LABEL}</span>
              ) : (
                <span className="font-mono text-xs">#{firmLiveView.intakeNumber}</span>
              )
            ) : null}
            {firmLiveView.routeStatus === 'preview_sent' &&
            onRequestFullAccess &&
            !firmLiveView.isFirmCodeIntake ? (
              <button
                type="button"
                className={`ml-auto rounded-full px-4 py-2 text-sm font-medium ${FIRM_REVIEW_PRIMARY_BUTTON}`}
                onClick={() =>
                  void onRequestFullAccess().then((r) => {
                    if (r.error) alert(r.error);
                    else showToastMessage('Full access request sent. The record owner is notified in their bell.');
                  })
                }
              >
                Request full review access
              </button>
            ) : null}
            {firmLiveView.routeStatus === 'full_access' && onReloadFirmLiveView ? (
              <button
                type="button"
                className={`ml-auto rounded-full px-4 py-2 text-sm font-medium ${FIRM_REVIEW_PRIMARY_BUTTON}`}
                onClick={() => {
                  void (async () => {
                    await onReloadFirmLiveView();
                    document.getElementById('firm-uploaded-files-section')?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  })();
                }}
              >
                Review uploaded files
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Demo orientation strip — sets context before the attorney reads a single word */}
      {demoMode && (
        <div className="bg-[#1B2623] px-5 py-4 border-b border-[#2C3A34]">
          <p className="text-sm text-white/90 leading-relaxed max-w-2xl">
            Marcus Rivera submitted 11 documents last night.{' '}
            <span className="text-[#7C8B6F]">
              This is what arrived in your review queue — organized, before your first call.
            </span>
          </p>
          <p className="text-xs text-white/38 mt-1">
            Scroll to read the full intake · scattered records arrived structured, before your first call
          </p>
        </div>
      )}

      {/* Content */}
      <div className="px-6 py-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">

            {/* Case Readiness Snapshot — attorney orientation card */}
            {useConnectedFirmLayout && firmLiveView ? (() => {
              const ctx = (firmLiveView.workerProvidedContext ?? firmWorkerStoryDisplay ?? '');
              const extract = (patterns: RegExp[]): string => {
                for (const p of patterns) {
                  const m = ctx.match(p);
                  if (m?.[1]?.trim()) return m[1].trim();
                }
                return '';
              };
              const workerName = polishNameForDisplay(extract([
                /full name used during employment[:\s]+([^\n]+)/i,
                /worker name[:\s]+([^\n]+)/i,
                /name[:\s]+([^\n]+)/i,
              ]));
              const employer = polishNameForDisplay(extract([
                /employer\s*\/?\s*organization[:\s]+([^\n]+)/i,
                /employer[:\s]+([^\n]+)/i,
                /organization[:\s]+([^\n]+)/i,
              ]));
              const employmentDates = extract([
                /employment dates?[:\s]+([^\n]+)/i,
                /dates? of employment[:\s]+([^\n]+)/i,
              ]);
              if (!workerName && !employer) return null;

              // Last employment event — latest event that is part of employment (not a post-separation record)
              const lastDocumentedEvent = (() => {
                const events = firmLiveView.events ?? [];
                const dated = events
                  .filter((e) => {
                    const d = e.event_date ?? '';
                    return d && !/date unclear|date to confirm|not yet clear/i.test(d);
                  })
                  .map((e) => ({ raw: e.event_date, ms: new Date(e.event_date).getTime(), title: e.title }))
                  .filter((d) => !isNaN(d.ms));
                if (!dated.length) return null;
                // Separate employment events from post-employment records (coworker statements, etc.)
                const termEvent = dated.find((d) => /terminat|separation/i.test(d.title));
                const termMs = termEvent?.ms ?? Infinity;
                const employmentEvents = dated.filter((d) => d.ms <= termMs);
                const postEvents = dated.filter((d) => d.ms > termMs);
                const latestEmployment = employmentEvents.sort((a, b) => b.ms - a.ms)[0];
                const latestRecord = dated.sort((a, b) => b.ms - a.ms)[0];
                const label = postEvents.length > 0 && latestRecord.ms > termMs
                  ? 'Last Employment Event'
                  : 'Last Documented Event';
                const useDate = latestEmployment ?? latestRecord;
                try {
                  const formatted = new Date(useDate.raw).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                  return { label, value: formatted };
                } catch {
                  return { label, value: useDate.raw };
                }
              })();

              const snapshotItems: Array<{ label: string; value: string }> = [];
              if (workerName) snapshotItems.push({ label: 'Worker', value: workerName });
              if (employer) snapshotItems.push({ label: 'Employer', value: employer });
              if (employmentDates) snapshotItems.push({ label: 'Employment Period', value: employmentDates });
              snapshotItems.push({ label: 'Records', value: `${reconstructedRecordCount} document${reconstructedRecordCount === 1 ? '' : 's'}` });
              if (lastDocumentedEvent) snapshotItems.push({ label: lastDocumentedEvent.label, value: lastDocumentedEvent.value });
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[20px] border border-[#E4E5DE] bg-[#1B2623] p-5 shadow-[0_14px_38px_rgba(31,27,75,0.18)]"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[#7C8B6F] mb-3">Intake Snapshot</p>
                  <div className="flex flex-wrap gap-x-8 gap-y-3">
                    {snapshotItems.map(item => (
                      <div key={item.label}>
                        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">{item.label}</p>
                        <p className="text-sm font-medium text-white">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  {timelineForDisplay.length > 0 && (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">The sequence</p>
                      <div className="flex flex-col gap-1.5">
                        {timelineForDisplay.slice(0, 4).map((e, i) => (
                          <div key={i} className="flex gap-3 text-sm">
                            <span className="w-28 shrink-0 font-medium text-[#7C8B6F]">{e.date}</span>
                            <span className="text-white/85">{e.event}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })() : null}

            {/* 3-Minute Review Layer — fast triage signal for attorneys */}
            {useConnectedFirmLayout && firmLiveView ? (() => {
              const hasStory = Boolean(
                firmLiveView.workerProvidedContext?.trim() || firmWorkerStoryDisplay?.trim()
              );
              const recordCount = firmLiveView.files.length;
              const eventCount = firmLiveView.events.length;
              const gapCount = confirmationDisplayCount;
              const followUp = firmLiveView.workerFollowUp;

              // Derive matter signals from event categories
              const matterSignals = Array.from(
                new Set(
                  (firmLiveView.events ?? [])
                    .map((e) => resolveEventDisplayCategory(e.category || '', polishTimelineEventTitle(e.title)))
                    .filter((c) => c && c !== 'Uncategorized')
                )
              ).slice(0, 5);

              const tags =
                firmLiveView.employmentMatterTags?.length
                  ? firmLiveView.employmentMatterTags
                  : matterSignals;

              const hasAnySignal = hasStory || recordCount > 0 || eventCount > 0 || followUp;
              if (!hasAnySignal) return null;

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 }}
                  className="rounded-[20px] border border-[#E4E5DE] bg-white/95 p-5 shadow-[0_14px_38px_rgba(31,27,75,0.08)]"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#42574E] mb-4">Processing Summary</p>

                  {/* Worker narrative — status chip */}
                  <div className="mb-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${
                        hasStory
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-[#E4E5DE] bg-[#FAF9F6] text-[#1B2623]/52'
                      }`}
                    >
                      {hasStory ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      Worker narrative {hasStory ? 'provided' : 'not provided'}
                    </span>
                  </div>

                  {/* Headline stats — the numbers land the moment the packet opens */}
                  {(recordCount > 0 || eventCount > 0 || gapCount > 0 || wageExposure) ? (
                    <div className="flex flex-wrap gap-2.5">
                      {recordCount > 0 ? (
                        <div className="min-w-[104px] flex-1 rounded-[14px] border border-[#E4E5DE] bg-[#FAF9F6] p-3 text-center">
                          <div className="text-[26px] font-black leading-none text-[#42574E]">{recordCount}</div>
                          <div className="mt-1 text-[11px] font-semibold text-[#1B2623]/55">Documents organized</div>
                        </div>
                      ) : null}
                      {eventCount > 0 ? (
                        <div className="min-w-[104px] flex-1 rounded-[14px] border border-[#E4E5DE] bg-[#FAF9F6] p-3 text-center">
                          <div className="text-[26px] font-black leading-none text-[#42574E]">{eventCount}</div>
                          <div className="mt-1 text-[11px] font-semibold text-[#1B2623]/55">Timeline events</div>
                        </div>
                      ) : null}
                      {gapCount > 0 ? (
                        <div className="min-w-[104px] flex-1 rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-center">
                          <div className="text-[26px] font-black leading-none text-amber-600">{gapCount}</div>
                          <div className="mt-1 text-[11px] font-semibold text-amber-700/80">Clarifications surfaced</div>
                        </div>
                      ) : null}
                      {wageExposure ? (
                        <div className="min-w-[104px] flex-1 rounded-[14px] border border-[#E4E5DE] bg-[#F2F4EC] p-3 text-center">
                          <div className="text-[22px] font-black leading-none text-[#42574E]">${Math.round(wageExposure.report.combinedEstimate).toLocaleString()}</div>
                          <div className="mt-1 text-[11px] font-semibold text-[#1B2623]/55">Wage exposure · from records</div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Worker context signals — employment status, arbitration, prior filing */}
                  {followUp && (followUp.employmentStatus || followUp.arbitrationAgreement || followUp.priorAgencyFiling) ? (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#E4E5DE]">
                      {followUp.employmentStatus ? (
                        <span className="inline-flex items-center rounded-full border border-[#E4E5DE] bg-[#F2F4EC] px-3 py-1.5 text-xs text-[#1B2623]/72">
                          <span className="font-medium text-[#1B2623]/45 mr-1.5">Employment:</span>
                          {followUp.employmentStatus === 'still_employed'
                            ? 'Still employed'
                            : followUp.employmentStatus === 'employment_ended'
                              ? 'Employment ended'
                              : 'Not confirmed'}
                        </span>
                      ) : null}
                      {followUp.arbitrationAgreement ? (
                        <span className="inline-flex items-center rounded-full border border-[#E4E5DE] bg-[#F2F4EC] px-3 py-1.5 text-xs text-[#1B2623]/72">
                          <span className="font-medium text-[#1B2623]/45 mr-1.5">Arbitration:</span>
                          {followUp.arbitrationAgreement === 'yes'
                            ? 'Agreement on file'
                            : followUp.arbitrationAgreement === 'no'
                              ? 'No agreement'
                              : 'Not confirmed'}
                        </span>
                      ) : null}
                      {followUp.priorAgencyFiling ? (
                        <span className="inline-flex items-center rounded-full border border-[#E4E5DE] bg-[#F2F4EC] px-3 py-1.5 text-xs text-[#1B2623]/72">
                          <span className="font-medium text-[#1B2623]/45 mr-1.5">Prior filing:</span>
                          {followUp.priorAgencyFiling === 'yes'
                            ? 'Yes'
                            : followUp.priorAgencyFiling === 'no'
                              ? 'No'
                              : 'Not confirmed'}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Matter signals from timeline categories or matter tags */}
                  {tags.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#E4E5DE]">
                      {tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-[#E4E5DE] bg-[#F2F4EC] px-3 py-1 text-xs text-[#42574E]"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </motion.div>
              );
            })() : null}

            {/* Firm Actions — elevated to top so attorneys see next steps immediately */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
              className={FIRM_REVIEW_PROMINENT_CARD}
            >
              <h3 className="text-sm font-semibold text-[#1B2623] mb-3">Firm Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={handleDownloadSummary}
                  className={`w-full flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${FIRM_REVIEW_PRIMARY_BUTTON}`}
                >
                  <Download className="w-4 h-4" />
                  Download Intake Summary
                </button>
                {/* AI extraction runs automatically in the background — no button needed */}
                {firmLiveView?.routeStatus === 'full_access' && onReloadFirmLiveView ? (
                  <button
                    type="button"
                    onClick={() => void onReloadFirmLiveView()}
                    className="w-full flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800"
                  >
                    <FileText className="w-4 h-4" />
                    Review uploaded files
                  </button>
                ) : null}
                {firmLiveView?.routeStatus === 'full_access' && !isFirmAccepted && !isFirmDeclined ? (
                  <div className="flex gap-2">
                    {onAcceptIntake ? (
                      <button
                        onClick={() => void handleAcceptIntake()}
                        className={`flex-1 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${FIRM_REVIEW_PRIMARY_BUTTON}`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Accept
                      </button>
                    ) : null}
                    {onDeclineIntake ? (
                      <button
                        onClick={() => setShowDeclineConfirm(true)}
                        className="flex-1 flex items-center justify-center gap-2 rounded-full border border-[#E4E5DE] bg-white px-4 py-2.5 text-sm font-medium text-[#6A6D66] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                      >
                        Not Pursuing
                      </button>
                    ) : null}
                  </div>
                ) : isFirmAccepted || firmLiveView?.routeStatus === 'accepted' ? (
                  <div className="w-full flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    Added for follow-up
                  </div>
                ) : isFirmDeclined ? (
                  <div className="w-full flex items-center gap-2 rounded-full border border-[#E4E5DE] bg-[#FAF9F6] px-4 py-2.5 text-sm font-medium text-[#7C857F]">
                    Marked as not pursuing
                  </div>
                ) : null}
                {onRequestAdditionalDocuments ? (
                  <button
                    type="button"
                    onClick={openFirmDocRequestModal}
                    className={`w-full flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${FIRM_REVIEW_SECONDARY_BUTTON}`}
                  >
                    Request Additional Documents
                  </button>
                ) : null}
              </div>
            </motion.div>

            {/* Worker-provided context (persisted in intake summary; not verified fact) */}
            {useConnectedFirmLayout && firmLiveView ? (
              firmWorkerStoryDisplay ? (
                <FirmExpandableSection
                  title={FIRM_REVIEW_SECTION.workerStory}
                  meta="Personal narrative shared for organization"
                  preview={firmWorkerStoryDisplay.slice(0, 140)}
                  forceOpen
                  className="border-[#E4E5DE] bg-white/95 shadow-[0_28px_90px_rgba(31,27,75,0.12)]"
                >
                  <p className="text-xs text-[#7C857F] mb-3 leading-relaxed">
                    Shared in the worker&apos;s own words for record organization. Not verified fact or legal analysis.
                  </p>
                  <FirmCollapsibleText text={firmWorkerStoryDisplay} preserveWhitespace />
                </FirmExpandableSection>
              ) : null
            ) : null}
            {!(useConnectedFirmLayout && firmLiveView) ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.075 }}
                className={FIRM_REVIEW_PROMINENT_CARD}
              >
              <h2 className="text-base font-semibold text-[#1B2623] mb-4">Worker Context</h2>
                <>
                  <div className="relative">
                    {!isContextExpanded && (
                      <>
                        <p className="text-sm text-[#1B2623]/70 leading-relaxed">
                          I worked as a delivery driver and frequently worked over 40 hours per week without proper overtime pay.
                        </p>
                        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/95 to-transparent pointer-events-none"></div>
                      </>
                    )}
                    {isContextExpanded && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="text-sm text-[#1B2623]/70 leading-relaxed"
                      >
                        I worked as a delivery driver and frequently worked over 40 hours per week without proper overtime pay. I also had concerns about meal periods being shortened or skipped during busy shifts. There were multiple occasions where I had to work through lunch breaks to meet delivery quotas, and my manager would often ask me to clock out early even though I was still working. I tried to document as much as I could through my own records and communications with coworkers.
                      </motion.p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsContextExpanded(!isContextExpanded)}
                    className="mt-5 text-xs font-medium text-[#42574E] transition-colors hover:text-[#1B2623]"
                  >
                    {isContextExpanded ? 'Show Less' : 'View Full Context'}
                  </button>
                </>
            </motion.div>
            ) : null}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className={FIRM_REVIEW_PROMINENT_CARD}
            >
              <h2 className="text-sm font-semibold text-[#1B2623] mb-2">Intake Overview</h2>
              {useConnectedFirmLayout && firmLiveView ? (
                <div className="space-y-3">
                  {firmOverviewFields
                    .filter((f) => {
                      const v = (f.value ?? '').trim().toLowerCase();
                      return v && v !== 'n/a' && v !== 'na' && v !== 'not provided' && v !== 'none' && v !== 'no';
                    })
                    .map((field) => (
                      <div key={field.label} className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase tracking-wider text-[#1B2623]/42">{field.label}</span>
                        <span className="text-sm text-[#1B2623]/80 leading-snug">{field.value}</span>
                      </div>
                    ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-white text-[#1B2623] rounded-lg text-sm border border-[#E4E5DE]">
                    Overtime concerns
                  </span>
                  <span className="px-3 py-1.5 bg-white text-[#1B2623] rounded-lg text-sm border border-[#E4E5DE]">
                    Meal & rest period concerns
                  </span>
                </div>
              )}
            </motion.div>

            {/* Intake Overview */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="hidden bg-white border border-[#E4E5DE] rounded-[14px] p-5"
            >
              <h2 className="text-sm font-semibold text-[#1B2623] mb-4">{FIRM_REVIEW_SECTION.intakeOverview}</h2>
              {useConnectedFirmLayout && firmLiveView && firmOverviewFields.length > 0 ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {firmOverviewFields.map((field) => (
                    <div key={field.label}>
                      <dt className="text-xs text-[#7C857F] mb-1">{field.label}</dt>
                      <dd className="text-sm text-[#1B2623] leading-snug whitespace-pre-wrap">
                        {polishHumanReadableDisplayText(field.value) || field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {useConnectedFirmLayout && firmLiveView ? (
                    <>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Intake reference</div>
                        <span
                          className={`text-sm text-[#384039] ${isSampleFirmIntakeIdentifier ? 'font-medium' : 'font-mono'}`}
                        >
                          {isSampleFirmIntakeIdentifier
                            ? SAMPLE_INTAKE_PREVIEW_DISPLAY_LABEL
                            : `#${firmLiveView.intakeNumber}`}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Records in preview</div>
                        <span className="text-sm text-[#384039]">{firmLiveView.files.length}</span>
                      </div>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Access level</div>
                        <span className="text-sm text-[#384039]">
                          {firmLiveView.previewOnly ? 'Limited preview' : 'Full materials'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Location</div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#9AA39B]" />
                          <span className="text-sm text-[#384039]">Los Angeles, CA</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Employer State</div>
                        <span className="text-sm text-[#384039]">California</span>
                      </div>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Upload Date</div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#9AA39B]" />
                          <span className="text-sm text-[#384039]">May 10, 2026</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {documentCategoriesForDisplay.length > 0 ? (
                <div className="mt-5 pt-5 border-t border-[#F2F4EC]">
                  <div className="text-xs text-[#7C857F] mb-2">Record categories on file</div>
                  <div className="flex flex-wrap gap-2">
                    {documentCategoriesForDisplay.map((cat) => (
                      <span
                        key={cat.name}
                        className="px-3 py-1.5 bg-[#FAF9F6] rounded-lg text-xs text-[#384039] border border-[#E4E5DE]"
                      >
                        {cat.name} ({cat.count})
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </motion.div>

            <div className="hidden space-y-3">
              <div className="hidden">
              <FirmExpandableSection
                title={FIRM_REVIEW_SECTION.fullRecordSummary}
                meta="Organized intake overview"
                preview={
                  useConnectedFirmLayout && firmLiveView
                    ? polishFirmFacingProse(firmLiveView.overview || '').slice(0, 140) ||
                      'Summary overview will appear after the organized summary is saved.'
                    : 'Organized overview from uploaded records.'
                }
              >
                <div className="text-sm text-[#384039] leading-relaxed space-y-2">
                  {useConnectedFirmLayout && firmLiveView ? (
                    <FirmCollapsibleText
                      text={
                        polishFirmFacingProse(firmLiveView.overview || '') ||
                        'Summary overview will appear after the organized summary is generated or saved.'
                      }
                    />
                  ) : firmLiveView?.overview ? (
                    <FirmCollapsibleText text={polishFirmFacingProse(firmLiveView.overview)} />
                  ) : (
                    <>
                      <p>
                        Records indicate a delivery driver employment situation involving payroll activities, timekeeping records, and workplace communications. Uploaded materials reflect ongoing employment activity across multiple pay periods, with worker-provided context highlighting concerns about overtime compensation and meal period compliance.
                      </p>
                      <p>
                        The worker has provided 12 employment-related documents organized into 3 distinct categories. Worker-edited file names and timeline context helped inform the organizational structure and chronology continuity.
                      </p>
                    </>
                  )}
                </div>
              </FirmExpandableSection>

              <FirmExpandableSection
                title={FIRM_REVIEW_SECTION.timelineReview}
                meta="Timeline overview"
                preview={
                  useConnectedFirmLayout && firmLiveView
                    ? polishFirmFacingProse(firmLiveView.timelineSummary || '').slice(0, 140) ||
                      'See timeline highlights below for event detail.'
                    : 'Employment timeline organized from records.'
                }
              >
                <div className="text-sm text-[#384039] leading-relaxed space-y-2">
                  {useConnectedFirmLayout && firmLiveView ? (
                    <FirmCollapsibleText
                      text={
                        polishFirmFacingProse(firmLiveView.timelineSummary || '') ||
                        'Timeline highlights are reflected in the section below.'
                      }
                      preserveWhitespace
                    />
                  ) : (
                    <>
                      <p>
                        Employment records associated with onboarding establish the beginning of the employment relationship in January 2025. Payroll records spanning 6 pay periods were grouped chronologically and cross-referenced with related timekeeping materials from February through March 2025.
                      </p>
                      <p>
                        Workplace communications (3 files) were organized by topic and timeline relevance, with references to scheduling updates, shift coverage, and meal period concerns. Worker-provided context states instances of working through lunch breaks to meet delivery quotas and being asked to clock out early while continuing work.
                      </p>
                      <p>
                        Timeline continuity extends through May 2025, with final pay records indicating potential outstanding overtime compensation questions.
                      </p>
                    </>
                  )}
                </div>
              </FirmExpandableSection>
              </div>
            </div>

            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={FIRM_REVIEW_PROMINENT_CARD}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#42574E]">Chronology</p>
              <h2 className="mt-3 text-2xl font-semibold text-[#1B2623]">
                {timelineForDisplay.length} event{timelineForDisplay.length === 1 ? '' : 's'} from {reconstructedRecordCount} record{reconstructedRecordCount === 1 ? '' : 's'}
              </h2>
              {confirmationDisplayCount > 0 ? (
                <p className="mt-2 text-sm leading-relaxed text-[#1B2623]/68">
                  {confirmationDisplayCount} item{confirmationDisplayCount === 1 ? '' : 's'} may benefit from confirmation.
                </p>
              ) : null}
              <p className="mt-2 text-sm leading-relaxed text-[#1B2623]/55">
                Each event shows its source document. Dates requiring confirmation are identified.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {chronologySteps.map((step, index) => (
                  <div
                    key={`${step}-${index}`}
                    className={`rounded-full border px-3 py-1.5 text-xs ${
                      index === 0
                        ? 'border-[#42574E] bg-[#42574E] text-white'
                        : 'border-[#D3DED6] bg-[#EEF2EE] text-[#6A6D66]'
                    }`}
                  >
                    {step}
                  </div>
                ))}
              </div>

              <div className="mt-9 space-y-4 sm:hidden">
                {timelineForDisplay.length === 0 ? (
                  <p className="text-sm text-[#1B2623]/62 py-2 leading-relaxed">
                    {preferConnectedLiveIntake
                      ? liveTimelineEmptyMessage
                      : 'No timeline events are available in this preview yet.'}
                  </p>
                ) : (
                  timelineForDisplay.map((event, index) => {
                    const mobileRelatedDocLabels = event.directFileLabels ?? (useConnectedFirmLayout ? relatedDocLabelsForCategory(event.category) : []);

                    return (
                      <article
                        key={`mobile-${event.date}-${event.event}-${index}`}
                        className="rounded-2xl border border-[#E4E5DE] bg-white p-4 shadow-[0_12px_34px_rgba(31,27,75,0.08)]"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F2F4EC] text-xs font-semibold text-[#42574E]">
                            {index + 1}
                          </div>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#42574E] whitespace-nowrap overflow-hidden text-ellipsis">
                              {event.date}
                            </p>
                            <h3 className="mt-1 text-base font-semibold leading-snug text-[#1B2623] break-words">
                              {event.event}
                            </h3>
                            {event.category ? (
                              <p className="mt-1 text-xs text-[#1B2623]/48 break-words">{event.category}</p>
                            ) : null}
                          </div>
                        </div>

                        {event.summary ? (
                          <p className="mt-4 text-sm leading-relaxed text-[#1B2623]/68 break-words overflow-hidden">{event.summary}</p>
                        ) : null}

                        {mobileRelatedDocLabels.length > 0 ? (
                          <div className="mt-4 rounded-xl border border-[#E4E5DE] bg-[#FAF9F6] px-3 py-2">
                            <p className="text-xs font-medium text-[#1B2623]/58">Supporting records</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {mobileRelatedDocLabels.slice(0, 3).map((label) => (
                                <span
                                  key={`${event.date}-${event.event}-${label}`}
                                  className="rounded-full border border-[#E4E5DE] bg-white px-2.5 py-1 text-xs text-[#1B2623]/68 max-w-[180px] truncate"
                                  title={label.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}
                                >
                                  {label.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}
                                </span>
                              ))}
                              {mobileRelatedDocLabels.length > 3 ? (
                                <span className="rounded-full border border-[#E4E5DE] bg-white px-2.5 py-1 text-xs text-[#1B2623]/52">
                                  +{mobileRelatedDocLabels.length - 3} more
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : event.relatedDocs > 0 ? (
                          <p className="mt-4 text-xs text-[#1B2623]/52">
                            {event.relatedDocs} supporting record{event.relatedDocs === 1 ? '' : 's'}
                          </p>
                        ) : null}
                      </article>
                    );
                  })
                )}
              </div>

              <div className="mt-9 hidden space-y-6 sm:block">
                {timelineForDisplay.length === 0 ? (
                  <p className="text-sm text-[#6A6D66] py-2 leading-relaxed">
                    {preferConnectedLiveIntake
                      ? liveTimelineEmptyMessage
                      : 'No timeline events are available in this preview yet.'}
                  </p>
                ) : (
                  timelineForDisplay.map((event, index) => (
                    <FirmTimelineEventCard
                      key={`${event.date}-${event.event}-${index}`}
                      date={event.date}
                      category={event.category}
                      title={event.event}
                      summary={event.summary}
                      relatedDocs={event.relatedDocs}
                      relatedDocLabels={event.directFileLabels ?? (useConnectedFirmLayout ? relatedDocLabelsForCategory(event.category) : [])}
                      important={index === 0 || event.relatedDocs >= 2}
                      isLast={index === timelineForDisplay.length - 1}
                    />
                  ))
                )}
              </div>
            </motion.section>

            {chronologyGapLines.length > 0 ? (
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="hidden rounded-xl border border-[#B08D57]/25 bg-[#1B2623] p-5"
              >
                <h3 className="text-sm font-semibold text-[#E8E6E3] mb-3">May Benefit From Review</h3>
                <div className="space-y-2">
                  {chronologyGapLines.map((line, index) => (
                    <p key={`${line}-${index}`} className="text-sm leading-relaxed text-[#E8E6E3]/65">
                      {line || 'Timeline continuity may benefit from supporting materials.'}
                    </p>
                  ))}
                </div>
              </motion.section>
            ) : null}

            <FirmExpandableSection
              title="Supporting Records"
              meta={`${documentCategoriesForDisplay.length} categories`}
              preview="Records organized below the chronology."
              defaultOpen
              className="border-[#E4E5DE] bg-white/95 shadow-[0_28px_90px_rgba(31,27,75,0.12)]"
            >
              <p className="text-xs text-[#1B2623]/62 mb-4 leading-relaxed">
                Documents support timeline events. The chronology remains the primary review surface.
              </p>
              {firmFileOpenError ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  {firmFileOpenError}
                </p>
              ) : null}
              <div id="firm-uploaded-files-section" className="space-y-2">
                {documentCategoriesForDisplay.length === 0 ? (
                  <p className="text-sm text-[#1B2623]/62 py-2 leading-relaxed">
                    {preferConnectedLiveIntake ? liveDocumentsEmptyMessage : 'No documents listed in this preview yet.'}
                  </p>
                ) : (
                  documentCategoriesForDisplay.map((category) => (
                  <div key={category.name} className="overflow-hidden rounded-2xl border border-[#E4E5DE] bg-[#FAF9F6]">
                    <button
                      onClick={() => setExpandedCategory(expandedCategory === category.name ? null : category.name)}
                      className="w-full flex items-center justify-between p-4 transition-colors hover:bg-[#F2F4EC]"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-[#42574E]" />
                        <div className="text-left">
                          <div className="text-sm font-medium text-[#1B2623]">{category.name}</div>
                          <div className="text-xs text-[#1B2623]/52">{category.count} documents</div>
                        </div>
                      </div>
                      {expandedCategory === category.name ? (
                        <ChevronDown className="w-5 h-5 text-[#9AA39B]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[#9AA39B]" />
                      )}
                    </button>

                    {expandedCategory === category.name && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-[#E4E5DE] bg-[#FAF9F6]"
                      >
                        <div className="p-4 space-y-2">
                          {category.documents.map((doc) => (
                            <div
                              key={firmDocumentEntryKey(doc)}
                              className="flex items-center justify-between rounded-xl border border-[#E4E5DE] bg-white p-2 transition-colors hover:border-[#7C8B6F]"
                            >
                              <span className="text-sm text-[#1B2623]/72">{doc.label}</span>
                              {canOpenFirmFile(doc) ? (
                                <button
                                  type="button"
                                  disabled={firmFileOpeningKey === firmDocumentEntryKey(doc)}
                                  onClick={() => void handleFirmViewFile(doc)}
                                  className="text-xs font-medium text-[#42574E] transition-colors hover:text-[#1B2623] disabled:opacity-50"
                                >
                                  {firmFileOpeningKey === firmDocumentEntryKey(doc) ? 'Opening…' : 'View'}
                                </button>
                              ) : (
                                <span className="text-xs text-[#9AA39B]">
                                  {firmRouteStatus === 'full_access' ? 'Unavailable' : 'Preview only'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )))}
              </div>
            </FirmExpandableSection>

            {/* Phase 2B: Extracted facts panel — shown when document intelligence block is present */}
            {firmLiveView?.intelligence ? (() => {
              const intel = firmLiveView.intelligence!;
              // Defensive: API cast may return null instead of [] for array fields
              const intelCorroboration: string[] = Array.isArray(intel.coworkerCorroboration) ? intel.coworkerCorroboration : [];
              const intelTimingIntervals: typeof intel.timingIntervals = Array.isArray(intel.timingIntervals) ? intel.timingIntervals : [];
              const intelKeyQuotes: typeof intel.keyQuotes = Array.isArray(intel.keyQuotes) ? intel.keyQuotes : [];
              const intelConfirmationNeeded: string[] = Array.isArray(intel.confirmationNeeded) ? intel.confirmationNeeded : [];
              const confirmedFacts: Array<{ label: string; value: string }> = [];
              if (intel.confirmedComplaintTopic)
                confirmedFacts.push({ label: 'HR complaint topic', value: intel.confirmedComplaintTopic });
              if (intel.confirmedComplaintDate)
                confirmedFacts.push({ label: 'Complaint date', value: intel.confirmedComplaintDate });
              if (intel.confirmedHrResponseSummary)
                confirmedFacts.push({ label: 'HR response', value: intel.confirmedHrResponseSummary });
              if (intel.confirmedWarningReason)
                confirmedFacts.push({ label: 'Warning states', value: intel.confirmedWarningReason });
              if (intel.confirmedWarningDate)
                confirmedFacts.push({ label: 'Warning date', value: intel.confirmedWarningDate });
              if (intel.confirmedTerminationReason)
                confirmedFacts.push({ label: 'Termination states', value: intel.confirmedTerminationReason });
              if (intel.confirmedTerminationDate)
                confirmedFacts.push({ label: 'Termination date', value: intel.confirmedTerminationDate });
              if (intelCorroboration.length)
                confirmedFacts.push({ label: 'Coworker confirms', value: intelCorroboration.join('; ') });

              if (!confirmedFacts.length && !intelTimingIntervals.length && !intelKeyQuotes.length) return null;

              // Time-sensitive date calculation — elapsed days since key event
              // Note: we surface a date flag for attorney review only. We do not
              // determine the applicable agency, jurisdiction, or filing deadline.
              const solDateStr = intel.confirmedTerminationDate || intel.confirmedComplaintDate;
              let solDaysElapsed: number | null = null;
              if (solDateStr) {
                const parsed = new Date(solDateStr);
                if (!isNaN(parsed.getTime())) {
                  const today = new Date();
                  solDaysElapsed = Math.floor((today.getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24));
                }
              }
              const showSolBanner = solDaysElapsed !== null && solDaysElapsed >= 120;

              // Determine if matter tags suggest a potential agency-filing matter
              // (discrimination, harassment, retaliation under federal/state civil rights law)
              const matterTags = firmLiveView?.employmentMatterTags ?? [];
              const hasPotentialAgencyMatter = matterTags.some(t =>
                ['discrimination', 'harassment', 'retaliation', 'wrongful_termination'].includes(t)
              );

              return (
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[24px] border border-[#E4E5DE] bg-white p-5 shadow-[0_14px_38px_rgba(31,27,75,0.08)]"
                >
                  {showSolBanner && solDaysElapsed !== null && (
                    <div className="flex items-start gap-3 rounded-xl px-4 py-3 mb-4 border bg-amber-50 border-amber-300">
                      <span className="text-base mt-0.5 text-amber-500">⚠</span>
                      <div>
                        <p className="text-xs font-semibold text-amber-700">
                          {hasPotentialAgencyMatter
                            ? 'Potential agency deadline — attorney review recommended'
                            : 'Time-sensitive dates present'}
                        </p>
                        <p className="text-[10px] mt-0.5 leading-snug text-amber-600/70">
                          {hasPotentialAgencyMatter
                            ? `${solDaysElapsed}d since ${intel.confirmedTerminationDate ? 'termination' : 'complaint'} · Filing periods depend on claim type, jurisdiction, and the specific triggering event.`
                            : 'Filing periods may depend on claim type, jurisdiction, and the specific triggering event. Attorney review required.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#42574E]">Extracted from documents</p>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5">
                      From document content
                    </span>
                  </div>

                  {confirmedFacts.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {confirmedFacts.map((f) => (
                        <div key={f.label} className="flex flex-col gap-0.5">
                          <span className="text-[10px] uppercase tracking-wider text-[#1B2623]/40">{f.label}</span>
                          <span className="text-sm text-[#1B2623]/82 leading-snug">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {intelTimingIntervals.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-[#1B2623]/40 mb-3">Event timing</p>
                      <div className="grid grid-cols-2 gap-2 mb-4">
                        {intelTimingIntervals.map((t) => {
                          const isShort = t.days <= 30;
                          const isMid = t.days > 30 && t.days <= 60;
                          return (
                            <div
                              key={t.label}
                              className={`rounded-xl px-3 py-2.5 border flex flex-col gap-0.5 ${
                                isShort
                                  ? 'bg-red-50 border-red-200'
                                  : isMid
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-[#F2F4EC] border-[#E4E5DE]'
                              }`}
                            >
                              <span className={`text-2xl font-900 leading-none tracking-tight ${
                                isShort ? 'text-red-600' : isMid ? 'text-amber-600' : 'text-[#42574E]'
                              }`} style={{ fontWeight: 900 }}>
                                {t.days}d
                              </span>
                              <span className={`text-[10px] font-semibold uppercase tracking-wide ${
                                isShort ? 'text-red-500' : isMid ? 'text-amber-600' : 'text-[#42574E]'
                              }`}>{t.label}</span>
                              <span className="text-[10px] text-[#1B2623]/55 leading-snug">
                                {t.description.replace(t.label + ': ', '')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {intelKeyQuotes.length > 0 && (
                    <>
                      <p className="text-[10px] uppercase tracking-wider text-[#1B2623]/40 mb-2">Key document language</p>
                      <div className="space-y-3">
                        {intelKeyQuotes.slice(0, 4).map((q) => {
                          // Extraction quality is internal metadata; the firm-facing label uses
                          // review language (per the one3seven dictionary), never "confidence".
                          const conf = (q.confidence || '').toLowerCase();
                          const extractionLabel =
                            conf === 'high'
                              ? 'Clear record match'
                              : conf === 'low'
                              ? 'Needs clarification'
                              : 'Review recommended';
                          const labelStyle =
                            conf === 'high'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                              : conf === 'low'
                              ? 'bg-rose-50 text-rose-600 border-rose-100'
                              : 'bg-amber-50 text-amber-700 border-amber-100';
                          return (
                            <div key={q.file_name} className="rounded-lg bg-[#F2F4EC] border border-[#E4E5DE] px-3 py-2">
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <p className="text-[10px] text-[#42574E]">{q.category.replace(/_/g, ' ')} — {q.file_name.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}</p>
                                {conf && (
                                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${labelStyle}`}>
                                    {extractionLabel}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#1B2623]/75 italic leading-relaxed">"{q.quote}"</p>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {(intel.overtimeIssueDetected || intel.finalPayPresent) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {intel.overtimeIssueDetected && (
                        <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
                          Overtime hours without matching rate
                        </span>
                      )}
                      {intel.finalPayPresent && (
                        <span className="text-[11px] bg-[#F2F4EC] text-[#42574E] border border-[#E4E5DE] rounded-full px-2.5 py-1">
                          Final pay document present
                        </span>
                      )}
                    </div>
                  )}
                </motion.section>
              );
            })() : null}

            {/* Items Requiring Confirmation — upgraded with intelligence when available */}
            {(() => {
              const rawConfirmationNeeded = firmLiveView?.intelligence?.confirmationNeeded;
              const intelligenceItems: string[] = Array.isArray(rawConfirmationNeeded) ? rawConfirmationNeeded : [];
              const fallbackItems = chronologyGapLines;
              const items = intelligenceItems.length > 0 ? intelligenceItems : fallbackItems;
              if (!items.length) return null;
              return (
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="rounded-[24px] border border-amber-200 bg-amber-50/85 p-5 shadow-[0_14px_38px_rgba(120,53,15,0.08)]"
                >
                  <h3 className="text-sm font-semibold text-[#1B2623] mb-3">
                    {intelligenceItems.length > 0 ? 'Items Requiring Confirmation' : 'Clarifications Needed'}
                  </h3>
                  <div className="space-y-2">
                    {items.map((line, index) => (
                      <p key={`${line}-${index}`} className="text-sm leading-relaxed text-[#1B2623]/70">
                        · {line}
                      </p>
                    ))}
                  </div>
                </motion.section>
              );
            })()}

            {/* Questions that may help complete the intake (Phase 2a clarification engine) */}
            {(() => {
              const rawClarifications = firmLiveView?.intelligence?.clarificationQuestions;
              const clarifications: string[] = Array.isArray(rawClarifications) ? rawClarifications : [];
              if (!clarifications.length) return null;
              return (
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="rounded-[24px] border border-[#E4E5DE] bg-[#F2F4EC] p-5 shadow-[0_14px_38px_rgba(31,27,75,0.08)]"
                >
                  <h3 className="text-sm font-semibold text-[#1B2623] mb-1">Questions that may help complete the intake</h3>
                  <p className="text-[11px] text-[#1B2623]/45 mb-3">Suggested follow-ups drawn from gaps in the uploaded records. Not legal advice.</p>
                  <div className="space-y-2">
                    {clarifications.map((line, index) => (
                      <p key={`${line}-${index}`} className="text-sm leading-relaxed text-[#1B2623]/70">
                        · {line}
                      </p>
                    ))}
                  </div>
                </motion.section>
              );
            })()}

            {firmLiveView?.documentRequest?.categories?.length ? (() => {
              const requested = firmLiveView.documentRequest!.categories;
              const fulfilled: string[] = firmLiveView?.documentResponse?.fulfilled ?? [];
              const fulfilledNorm = fulfilled.map((s) => s.toLowerCase().trim());
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[24px] border border-[#E4E5DE] bg-white p-5 shadow-[0_14px_38px_rgba(31,27,75,0.08)]"
                >
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#42574E]">Document Checklist</p>
                    {fulfilled.length > 0 && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5">
                        {fulfilled.length}/{requested.length} received
                      </span>
                    )}
                  </div>
                  <div className="space-y-2 mb-3">
                    {requested.map((c) => {
                      const isReceived = fulfilledNorm.includes(c.toLowerCase().trim());
                      return (
                        <div key={c} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border ${
                          isReceived ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
                        }`}>
                          <span className={`text-sm font-bold leading-none ${isReceived ? 'text-emerald-600' : 'text-amber-500'}`}>
                            {isReceived ? '✓' : '○'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-[#1B2623] leading-snug">
                              {polishHumanReadableDisplayText(c) || c}
                            </p>
                          </div>
                          <span className={`text-[10px] font-semibold uppercase tracking-wide shrink-0 ${
                            isReceived ? 'text-emerald-600' : 'text-amber-600'
                          }`}>
                            {isReceived ? 'Received' : 'Pending'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {firmLiveView.documentRequest!.note ? (
                    <p className="text-xs text-[#1B2623]/55 leading-relaxed border-t border-[#E4E5DE] pt-3">
                      {polishHumanReadableDisplayText(sanitizeFirmFacingText(firmLiveView.documentRequest!.note))}
                    </p>
                  ) : null}
                  {firmLiveView?.documentResponse?.note ? (
                    <p className="text-xs text-emerald-700/80 leading-relaxed border-t border-emerald-100 pt-3 mt-2">
                      Worker note: {polishHumanReadableDisplayText(firmLiveView.documentResponse.note)}
                    </p>
                  ) : null}
                </motion.div>
              );
            })() : null}

            {/* Legacy: show response note if no request categories present */}
            {!firmLiveView?.documentRequest?.categories?.length &&
            firmLiveView?.documentResponse &&
            (firmLiveView.documentResponse.fulfilled.length > 0 || firmLiveView.documentResponse.note) ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border border-emerald-200 rounded-[14px] p-4"
              >
                <h3 className="text-sm font-semibold text-[#1B2623] mb-2">Response to document request</h3>
                {firmLiveView.documentResponse.fulfilled.length > 0 ? (
                  <>
                    <p className="text-xs font-medium text-[#384039] mb-1">Fulfilled categories</p>
                    <ul className="list-disc pl-4 text-xs text-[#1B2623] space-y-1 mb-2">
                      {firmLiveView.documentResponse.fulfilled.map((c) => (
                        <li key={c}>{polishHumanReadableDisplayText(c) || c}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {firmLiveView.documentResponse.note ? (
                  <p className="text-xs text-[#384039] whitespace-pre-wrap">
                    <span className="font-medium">Their note:</span>{' '}
                    {polishHumanReadableDisplayText(sanitizeFirmFacingText(firmLiveView.documentResponse.note))}
                  </p>
                ) : null}
              </motion.div>
            ) : null}

            {/* Methodology statement — attorney trust layer */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[16px] border border-[#E4E5DE]/60 bg-[#FAF9F6] px-5 py-4"
            >
              <p className="text-[11px] leading-relaxed text-[#1B2623]/52">
                <span className="font-medium text-[#1B2623]/70">How this intake was organized:</span> one3seven organizes file names, extracted dates, worker-provided context, and document categories into a review structure. Automated organization may require confirmation against the original source records. one3seven does not provide legal conclusions, case scoring, or outcome predictions. Source documents are available for direct review.
              </p>
            </motion.div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={FIRM_REVIEW_QUIET_CARD}
              >
                <h3 className="text-sm font-semibold text-[#1B2623]/78 mb-3">Review Status</h3>
                <div className="space-y-3">
                  {firmReviewSteps.map((step, index) => {
                    const isDone = index < activeFirmStepIndex;
                    const isActive = index === activeFirmStepIndex;
                    return (
                      <div key={step.key} className="flex items-start gap-3">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold border ${
                            isDone || isActive
                              ? 'bg-[#42574E] text-white border-[#42574E]'
                              : 'bg-white text-[#1B2623]/34 border-[#E4E5DE]'
                          }`}
                        >
                          {isDone ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                        </div>
                        <div>
                          <span className={`text-sm ${isActive ? 'text-[#1B2623] font-medium' : 'text-[#1B2623]/58'}`}>
                            {step.label}
                          </span>
                          {isActive ? (
                            <div
                              className={`mt-1 inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${firmPersistedWorkflowToneClass(workflowPresentation.tone)}`}
                            >
                              {polishHumanReadableDisplayText(workflowPresentation.label) || workflowPresentation.label}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {usesPersistedWorkflowStatus ? (
                  <p className="mt-3 text-xs text-[#7C857F] leading-relaxed">
                    {isSampleFirmIntakePreview
                      ? 'Sample intake for orientation — status is illustrative only.'
                      : 'Reflects the live intake record. Updates when the worker responds or access changes.'}
                  </p>
                ) : canEditLocalWorkflow ? (
                  <>
                    <p className="mt-3 text-xs text-[#7C857F] mb-3 leading-relaxed">
                      Demo workspace only — changes here are not saved to live intakes.
                    </p>
                    <button
                      onClick={() => setShowStatusModal(true)}
                      className="w-full rounded-[12px] border border-[#E4E5DE] px-4 py-2.5 text-sm text-[#1B2623]/70 transition-colors hover:bg-[#F2F4EC] min-h-[44px] touch-manipulation"
                    >
                      Update demo workspace status
                    </button>
                  </>
                ) : (
                  <p className="mt-3 text-xs text-[#7C857F] leading-relaxed">
                    Connect a live intake from your firm dashboard to view persisted workflow status.
                  </p>
                )}
              </motion.div>

            {firmLiveView?.employmentMatterTags && firmLiveView.employmentMatterTags.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="hidden"
              >
                <h3 className="text-sm font-semibold text-[#1B2623]/78 mb-2">Employment Matter</h3>
                <EmploymentMatterChipList tags={firmLiveView.employmentMatterTags} />
              </motion.div>
            ) : null}

            {/* Intake Overview */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="hidden bg-white border border-[#E4E5DE] rounded-[14px] p-5"
            >
              <h2 className="text-sm font-semibold text-[#1B2623] mb-4">{FIRM_REVIEW_SECTION.intakeOverview}</h2>
              {useConnectedFirmLayout && firmLiveView && firmOverviewFields.length > 0 ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  {firmOverviewFields.map((field) => (
                    <div key={field.label}>
                      <dt className="text-xs text-[#7C857F] mb-1">{field.label}</dt>
                      <dd className="text-sm text-[#1B2623] leading-snug whitespace-pre-wrap">
                        {polishHumanReadableDisplayText(field.value) || field.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {useConnectedFirmLayout && firmLiveView ? (
                    <>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Intake reference</div>
                        <span
                          className={`text-sm text-[#384039] ${isSampleFirmIntakeIdentifier ? 'font-medium' : 'font-mono'}`}
                        >
                          {isSampleFirmIntakeIdentifier
                            ? SAMPLE_INTAKE_PREVIEW_DISPLAY_LABEL
                            : `#${firmLiveView.intakeNumber}`}
                        </span>
                      </div>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Records in preview</div>
                        <span className="text-sm text-[#384039]">{firmLiveView.files.length}</span>
                      </div>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Access level</div>
                        <span className="text-sm text-[#384039]">
                          {firmLiveView.previewOnly ? 'Limited preview' : 'Full materials'}
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Location</div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-[#9AA39B]" />
                          <span className="text-sm text-[#384039]">Los Angeles, CA</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Employer State</div>
                        <span className="text-sm text-[#384039]">California</span>
                      </div>
                      <div>
                        <div className="text-xs text-[#7C857F] mb-1.5">Upload Date</div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#9AA39B]" />
                          <span className="text-sm text-[#384039]">May 10, 2026</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {documentCategoriesForDisplay.length > 0 ? (
                <div className="mt-5 pt-5 border-t border-[#F2F4EC]">
                  <div className="text-xs text-[#7C857F] mb-2">Record categories on file</div>
                  <div className="flex flex-wrap gap-2">
                    {documentCategoriesForDisplay.map((cat) => (
                      <span
                        key={cat.name}
                        className="px-3 py-1.5 bg-[#FAF9F6] rounded-lg text-xs text-[#384039] border border-[#E4E5DE]"
                      >
                        {cat.name} ({cat.count})
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="hidden rounded-[14px] border border-[#E4E5DE] bg-[#FAF9F6]/80 p-4"
            >
              <h2 className="text-sm font-semibold text-[#1B2623] mb-2">Intake summary</h2>
              {useConnectedFirmLayout ? (
                <p className="text-sm leading-relaxed text-[#6A6D66]">
                  {polishFirmFacingProse(firmLiveView?.overview || '') ||
                    'Overview will appear after the intake record set is organized.'}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 bg-white text-[#1B2623] rounded-lg text-sm border border-[#E4E5DE]">
                    Overtime concerns
                  </span>
                  <span className="px-3 py-1.5 bg-white text-[#1B2623] rounded-lg text-sm border border-[#E4E5DE]">
                    Meal & rest period concerns
                  </span>
                </div>
              )}
            </motion.div>

            <div className="hidden space-y-3">
              <div className="hidden">
              <FirmExpandableSection
                title={FIRM_REVIEW_SECTION.fullRecordSummary}
                meta="Organized intake overview"
                preview={
                  useConnectedFirmLayout && firmLiveView
                    ? polishFirmFacingProse(firmLiveView.overview || '').slice(0, 140) ||
                      'Summary overview will appear after the organized summary is saved.'
                    : 'Organized overview from uploaded records.'
                }
              >
                <div className="text-sm text-[#384039] leading-relaxed space-y-2">
                  {useConnectedFirmLayout && firmLiveView ? (
                    <FirmCollapsibleText
                      text={
                        polishFirmFacingProse(firmLiveView.overview || '') ||
                        'Summary overview will appear after the organized summary is generated or saved.'
                      }
                    />
                  ) : firmLiveView?.overview ? (
                    <FirmCollapsibleText text={polishFirmFacingProse(firmLiveView.overview)} />
                  ) : (
                    <>
                      <p>
                        Records indicate a delivery driver employment situation involving payroll activities, timekeeping records, and workplace communications. Uploaded materials reflect ongoing employment activity across multiple pay periods, with worker-provided context highlighting concerns about overtime compensation and meal period compliance.
                      </p>
                      <p>
                        The worker has provided 12 employment-related documents organized into 3 distinct categories. Worker-edited file names and timeline context helped inform the organizational structure and chronology continuity.
                      </p>
                    </>
                  )}
                </div>
              </FirmExpandableSection>

              <FirmExpandableSection
                title={FIRM_REVIEW_SECTION.timelineReview}
                meta="Timeline overview"
                preview={
                  useConnectedFirmLayout && firmLiveView
                    ? polishFirmFacingProse(firmLiveView.timelineSummary || '').slice(0, 140) ||
                      'See timeline highlights below for event detail.'
                    : 'Employment timeline organized from records.'
                }
              >
                <div className="text-sm text-[#384039] leading-relaxed space-y-2">
                  {useConnectedFirmLayout && firmLiveView ? (
                    <FirmCollapsibleText
                      text={
                        polishFirmFacingProse(firmLiveView.timelineSummary || '') ||
                        'Timeline highlights are reflected in the section below.'
                      }
                      preserveWhitespace
                    />
                  ) : (
                    <>
                      <p>
                        Employment records associated with onboarding establish the beginning of the employment relationship in January 2025. Payroll records spanning 6 pay periods were grouped chronologically and cross-referenced with related timekeeping materials from February through March 2025.
                      </p>
                      <p>
                        Workplace communications (3 files) were organized by topic and timeline relevance, with references to scheduling updates, shift coverage, and meal period concerns. Worker-provided context states instances of working through lunch breaks to meet delivery quotas and being asked to clock out early while continuing work.
                      </p>
                      <p>
                        Timeline continuity extends through May 2025, with final pay records indicating potential outstanding overtime compensation questions.
                      </p>
                    </>
                  )}
                </div>
              </FirmExpandableSection>
              </div>

              <FirmExpandableSection
                title={FIRM_REVIEW_SECTION.recordsAvailable}
                meta={`${documentCategoriesForDisplay.length} categories`}
                preview={
                  firmRecordGroups.length
                    ? firmRecordGroups
                        .slice(0, 2)
                        .map((g) => `${g.label} (${g.categories.reduce((n, c) => n + c.count, 0)})`)
                        .join(' · ')
                    : documentCategoriesForDisplay.length
                      ? documentCategoriesForDisplay
                          .slice(0, 2)
                          .map((c) => `${c.name} (${c.count})`)
                          .join(' · ')
                      : 'Supporting records listed below.'
                }
              >
                <div>
                  {useConnectedFirmLayout && firmRecordGroups.length > 0 ? (
                    <div className="space-y-4">
                      {firmRecordGroups.map((group) => (
                        <div key={group.label}>
                          <div className="text-xs font-semibold text-[#1B2623] mb-2">{group.label}</div>
                          <ul className="text-sm text-[#384039] leading-relaxed space-y-1 list-none pl-0">
                            {group.categories.map((c) => (
                              <li key={`${group.label}-${c.name}`}>
                                • {c.name} ({c.count} {c.count === 1 ? 'record' : 'records'})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : useConnectedFirmLayout ? (
                    <ul className="text-sm text-[#384039] leading-relaxed space-y-1 list-none pl-0">
                      {documentCategoriesForDisplay.map((c) => (
                        <li key={c.name}>
                          • {c.name} ({c.count} {c.count === 1 ? 'document' : 'documents'})
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-[#384039] leading-relaxed space-y-1">
                      <p>• Pay Records (5 documents) support payroll activity and compensation patterns</p>
                      <p>• Time Records (4 documents) provide timekeeping and hours-worked documentation</p>
                      <p>• Workplace Communications (3 documents) offer context on scheduling and operational matters</p>
                    </div>
                  )}
                </div>
              </FirmExpandableSection>

              <FirmExpandableSection
                title={FIRM_REVIEW_SECTION.topicsInRecords}
                meta="Themes noted in uploaded materials"
                tone="quiet"
                preview={
                  firmReadinessPresentation.topics[0]?.slice(0, 120) ||
                  firmReadinessPresentation.supplementalBrief[0]?.slice(0, 120) ||
                  'Topic references from the record set.'
                }
              >
                {useConnectedFirmLayout && firmLiveView ? (
                  <div className="text-sm text-[#384039] leading-relaxed space-y-3">
                    {firmReadinessPresentation.topics.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {firmReadinessPresentation.topics.map((topic, i) => (
                          <li key={`topic-${i}`}>{topic}</li>
                        ))}
                      </ul>
                    ) : firmReadinessPresentation.supplementalBrief.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {firmReadinessPresentation.supplementalBrief.map((r, i) => (
                          <li key={`fb-${i}`}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#6A6D66]">No topic references were noted for this intake yet.</p>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-[#384039] leading-relaxed space-y-2">
                    <p>
                      Payroll records were grouped by pay period for clarity. Communication files were organized by topic and date range.
                    </p>
                  </div>
                )}
              </FirmExpandableSection>

              <FirmExpandableSection
                title={FIRM_REVIEW_SECTION.additionalContext}
                meta="Optional follow-up notes"
                tone="quiet"
                preview={
                  firmLiveView?.missing?.[0]
                    ? polishMissingContextLine(firmLiveView.missing[0]).slice(0, 120)
                    : 'Additional context that may help clarify the record set.'
                }
              >
                {useConnectedFirmLayout && firmLiveView ? (
                  <div className="text-sm text-[#384039] leading-relaxed space-y-3">
                    {firmLiveView.missing?.length ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {firmLiveView.missing.map((r, i) => (
                          <li key={i}>{polishMissingContextLine(r)}</li>
                        ))}
                      </ul>
                    ) : firmReadinessPresentation.additionalContext.length ? (
                      <ul className="list-disc pl-5 space-y-1">
                        {firmReadinessPresentation.additionalContext.map((r, i) => (
                          <li key={`ac-${i}`}>{r}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[#6A6D66]">
                        No additional context notes were recorded. The worker may be asked to provide supporting records if helpful.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-[#384039] leading-relaxed space-y-2">
                    <p className="text-[#6A6D66] text-xs italic">
                      Additional context may help clarify timeline continuity. Employment agreement documentation or manager communications could strengthen the chronological narrative.
                    </p>
                  </div>
                )}
              </FirmExpandableSection>
            </div>

            {wageExposure ? (
              <div className="mt-4">
                <WageExposureReviewSection wage={wageExposure} onOpenCitation={setOpenCitation} />
              </div>
            ) : null}

            <div className="hidden">
            <FirmExpandableSection
              title={FIRM_REVIEW_SECTION.timelineHighlights}
              meta={`${timelineForDisplay.length} events`}
              preview={
                timelineForDisplay[0]
                  ? `${timelineForDisplay[0].date} · ${timelineForDisplay[0].event}`
                  : 'Timeline entries from organized records.'
              }
              defaultOpen={timelineForDisplay.length > 0 && timelineForDisplay.length <= 3}
            >
              <div className="space-y-4">
                {timelineForDisplay.length === 0 ? (
                  <p className="text-sm text-[#6A6D66] py-2 leading-relaxed">
                    {preferConnectedLiveIntake
                      ? liveTimelineEmptyMessage
                      : 'No timeline events are available in this preview yet.'}
                  </p>
                ) : (
                  timelineForDisplay.map((event, index) => (
                    <FirmTimelineEventCard
                      key={`${event.date}-${event.event}-${index}`}
                      date={event.date}
                      category={event.category}
                      title={event.event}
                      summary={event.summary}
                      relatedDocs={event.relatedDocs}
                      relatedDocLabels={event.directFileLabels ?? (useConnectedFirmLayout ? relatedDocLabelsForCategory(event.category) : [])}
                      important={index === 0 || event.relatedDocs >= 2}
                      isLast={index === timelineForDisplay.length - 1}
                    />
                  ))
                )}
              </div>
            </FirmExpandableSection>
            </div>

            <div className="hidden">
            <FirmExpandableSection
              title="Supporting materials"
              meta={`${documentCategoriesForDisplay.length} categories`}
              preview="Records organized below the chronology."
            >
              <p className="text-xs text-[#6A6D66] mb-4 leading-relaxed">
                Documents support timeline events. The chronology remains the primary review surface.
              </p>
              {firmFileOpenError ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  {firmFileOpenError}
                </p>
              ) : null}
              <div className="space-y-2">
                {documentCategoriesForDisplay.length === 0 ? (
                  <p className="text-sm text-[#6A6D66] py-2 leading-relaxed">
                    {preferConnectedLiveIntake ? liveDocumentsEmptyMessage : 'No documents listed in this preview yet.'}
                  </p>
                ) : (
                  documentCategoriesForDisplay.map((category) => (
                  <div key={category.name} className="bg-[#FAF9F6] border border-[#E4E5DE] rounded-xl overflow-hidden">
                    <button
                      onClick={() => setExpandedCategory(expandedCategory === category.name ? null : category.name)}
                      className="w-full flex items-center justify-between p-4 hover:bg-[#F2F4EC] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-[#9AA39B]" />
                        <div className="text-left">
                          <div className="text-sm font-medium text-[#1B2623]">{category.name}</div>
                          <div className="text-xs text-[#7C857F]">{category.count} documents</div>
                        </div>
                      </div>
                      {expandedCategory === category.name ? (
                        <ChevronDown className="w-5 h-5 text-[#9AA39B]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-[#9AA39B]" />
                      )}
                    </button>

                    {expandedCategory === category.name && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="border-t border-[#E4E5DE] bg-[#FAF9F6]"
                      >
                        <div className="p-4 space-y-2">
                          {category.documents.map((doc) => (
                            <div
                              key={firmDocumentEntryKey(doc)}
                              className="flex items-center justify-between p-2 bg-white rounded-lg border border-[#E4E5DE] hover:border-[#7C8B6F] transition-colors"
                            >
                              <span className="text-sm text-[#384039]">{doc.label}</span>
                              {canOpenFirmFile(doc) ? (
                                <button
                                  type="button"
                                  disabled={firmFileOpeningKey === firmDocumentEntryKey(doc)}
                                  onClick={() => void handleFirmViewFile(doc)}
                                  className="text-xs text-[#6A6D66] hover:text-[#1B2623] transition-colors disabled:opacity-50"
                                >
                                  {firmFileOpeningKey === firmDocumentEntryKey(doc) ? 'Opening…' : 'View'}
                                </button>
                              ) : (
                                <span className="text-xs text-[#9AA39B]">
                                  {firmRouteStatus === 'full_access' ? 'Unavailable' : 'Preview only'}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                )))}
              </div>
            </FirmExpandableSection>
            </div>

            <FirmExpandableSection
              title="Internal reviewer notes"
              meta="Team-only notes"
              tone="quiet"
              preview="Internal notes for your review team."
              className="hidden border-[#E4E5DE] bg-white/70 shadow-[0_10px_30px_rgba(31,27,75,0.05)]"
            >
              {preferConnectedLiveIntake ? (
                <div className="rounded-2xl border border-[#E4E5DE] bg-[#FAF9F6] p-6">
                  <p className="text-sm text-[#1B2623]/64 leading-relaxed mb-3">
                    Internal team notes are not saved to live intakes during closed beta. Notes you add here would not
                    persist for your firm or sync across reviewers.
                  </p>
                  <textarea
                    value=""
                    readOnly
                    disabled
                    placeholder="Internal notes unavailable during closed beta"
                    className="w-full h-32 px-3 py-2 bg-[#FAF9F6] border border-[#E4E5DE] rounded-lg text-sm text-[#1B2623]/45 placeholder:text-[#1B2623]/35 resize-none mb-3 cursor-not-allowed"
                  />
                  <button
                    type="button"
                    disabled
                    className="w-full rounded-full border border-[#E4E5DE] bg-[#FAF9F6] px-4 py-2.5 text-sm font-medium text-[#1B2623]/38 cursor-not-allowed"
                  >
                    Notes unavailable during closed beta
                  </button>
                </div>
              ) : (
                <>
                  {savedNotes.length > 0 ? (
                    <div className="space-y-3 mb-6">
                      {savedNotes.map((note) => (
                        <div key={note.id} className="rounded-2xl border border-[#E4E5DE] bg-white p-5">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="w-8 h-8 bg-[#42574E] text-white rounded-full flex items-center justify-center text-xs font-medium">
                              {note.reviewer || '?'}
                            </div>
                            <div className="flex-1">
                              <div className="text-xs text-[#7C857F]">{note.timestamp}</div>
                            </div>
                          </div>
                          <p className="text-sm text-[#1B2623]/68 leading-relaxed">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#E4E5DE] bg-[#FAF9F6] p-8 mb-6 text-center">
                      <p className="text-sm text-[#1B2623]/52">No internal reviewer notes yet.</p>
                    </div>
                  )}

                  <div className="rounded-2xl border border-[#E4E5DE] bg-white p-6">
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Add internal notes for your team..."
                      className="w-full h-32 px-3 py-2 bg-[#FAF9F6] border border-[#E4E5DE] rounded-lg text-sm text-[#1B2623] placeholder:text-[#1B2623]/38 focus:outline-none focus:ring-2 focus:ring-[#42574E]/20 focus:border-[#42574E] resize-none mb-3"
                    />
                    <button
                      onClick={handleSaveNotes}
                      disabled={!internalNotes.trim()}
                      className={`w-full py-2.5 px-4 rounded-lg transition-colors text-sm font-medium ${
                        internalNotes.trim()
                          ? 'bg-[#42574E] text-white hover:bg-[#42574E]'
                          : 'bg-[#FAF9F6] text-[#1B2623]/35 cursor-not-allowed'
                      }`}
                    >
                      Save Note
                    </button>
                  </div>
                </>
              )}
            </FirmExpandableSection>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="hidden bg-white border border-[#E4E5DE] rounded-[14px] p-5"
            >
              <h3 className="text-sm font-semibold text-[#1B2623] mb-3">Firm actions</h3>
              <div className="space-y-2">
                <button
                  onClick={handleDownloadSummary}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#42574E] text-white rounded-lg hover:bg-[#42574E] transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download Intake Summary
                </button>
                {firmLiveView?.routeStatus === 'full_access' && onReloadFirmLiveView ? (
                  <button
                    type="button"
                    onClick={() => void onReloadFirmLiveView()}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-emerald-800 text-white rounded-lg hover:bg-emerald-900 transition-colors text-sm font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    Review uploaded files
                  </button>
                ) : null}
                {firmLiveView?.routeStatus === 'full_access' && !isFirmAccepted && !isFirmDeclined ? (
                  <div className="flex gap-2">
                    {onAcceptIntake ? (
                      <button
                        onClick={() => void handleAcceptIntake()}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#42574E] text-white rounded-lg hover:bg-[#42574E] transition-colors text-sm font-medium"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Accept
                      </button>
                    ) : null}
                    {onDeclineIntake ? (
                      <button
                        onClick={() => setShowDeclineConfirm(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-[#E4E5DE] bg-white text-[#6A6D66] rounded-lg hover:border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors text-sm font-medium"
                      >
                        Not Pursuing
                      </button>
                    ) : null}
                  </div>
                ) : isFirmAccepted || firmLiveView?.routeStatus === 'accepted' ? (
                  <div className="w-full flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Added for follow-up
                  </div>
                ) : isFirmDeclined ? (
                  <div className="w-full flex items-center gap-2 px-4 py-2.5 bg-[#FAF9F6] text-[#7C857F] rounded-lg border border-[#E4E5DE] text-sm font-medium">
                    Marked as not pursuing
                  </div>
                ) : null}
                {onRequestAdditionalDocuments ? (
                  <button
                    type="button"
                    onClick={openFirmDocRequestModal}
                    className="w-full flex items-center gap-2 px-4 py-2.5 bg-white text-[#1B2623] rounded-lg border border-[#E4E5DE] hover:bg-[#F2F4EC] transition-colors text-sm font-medium"
                  >
                    Request Additional Documents
                  </button>
                ) : null}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="hidden"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-[#7C857F] flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-[#1B2623]/70 mb-1">Workflow Observation</h3>
                  <p className="text-xs text-[#1B2623]/55 leading-relaxed">
                    Some timeline events reference additional documentation that may improve organization clarity.
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="border-t border-[#E4E5DE] px-2 py-4"
            >
              <p className="text-xs text-[#1B2623]/55 leading-relaxed">
                {ONE3SEVEN_NOTICES.positioning}
                <br />
                <br />
                Participating firms choose their own next steps inside their organization. one3seven does not score intakes or rank people.
              </p>
            </motion.div>

            {/* Demo sign-up card — appears after the attorney has read the full intake */}
            {demoMode && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-[28px] overflow-hidden shadow-[0_28px_80px_rgba(66,87,78,0.18)]"
                style={{ background: 'linear-gradient(145deg, #1B2623 0%, #2C3A34 55%, #42574E 100%)' }}
              >
                <div className="px-7 py-8">
                  <p className="text-[10px] font-700 uppercase tracking-[0.2em] text-[#7C8B6F] mb-3" style={{ fontWeight: 700 }}>
                    Your practice · one3seven
                  </p>
                  <h3 className="text-2xl font-black text-white leading-tight mb-2" style={{ letterSpacing: '-0.02em' }}>
                    Your next intake<br />could look like this.
                  </h3>
                  <p className="text-sm text-white/55 mb-6 leading-relaxed max-w-sm">
                    Workers submit their documents. You open a structured review — timeline built, timing relationships between events identified, records organized. Before the consultation starts.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => { window.location.href = window.location.pathname; }}
                      className="rounded-full px-6 py-3 text-sm font-semibold text-white transition-colors"
                      style={{ background: '#42574E', boxShadow: '0 8px 24px rgba(66,87,78,0.4)' }}
                    >
                      Start 7-day free trial →
                    </button>
                    <button
                      onClick={() => { window.location.href = window.location.pathname; }}
                      className="rounded-full border border-white/20 px-6 py-3 text-sm font-medium text-white/75 hover:border-white/35 hover:text-white transition-colors"
                    >
                      See pricing
                    </button>
                  </div>
                  <p className="text-[10px] text-white/28 mt-4">No card required · Practice from $249/mo after trial</p>
                </div>
              </motion.div>
            )}
        </div>
      </div>

      {/* Decline Confirmation Modal */}
      <AnimatePresence>
        {showDeclineConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[190] bg-black/40"
              onClick={() => !declineSubmitting && setShowDeclineConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="fixed inset-x-4 bottom-6 z-[200] mx-auto max-w-sm rounded-3xl bg-white p-6 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2"
            >
              <h3 className="text-base font-semibold text-[#1B2623] mb-2">
                Mark as not pursuing?
              </h3>
              <p className="text-sm text-[#1B2623]/65 leading-relaxed mb-6">
                This intake will stay in your review queue for reference. The worker won't be notified — this is an internal status only.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeclineConfirm(false)}
                  disabled={declineSubmitting}
                  className="flex-1 rounded-full border border-[#E4E5DE] py-3 text-sm font-medium text-[#6A6D66] transition-colors hover:bg-[#F2F4EC] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeclineIntake()}
                  disabled={declineSubmitting}
                  className="flex-1 rounded-full bg-[#42574E] py-3 text-sm font-medium text-white transition-colors hover:bg-[#42574E] disabled:opacity-50"
                >
                  {declineSubmitting ? 'Saving…' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 bg-[#42574E] text-white px-6 py-3 rounded-lg shadow-lg z-50 text-sm"
          >
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Demo workspace workflow status (local only — never shown for live intakes) */}
      <AnimatePresence>
        {showStatusModal && canEditLocalWorkflow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1B2623]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowStatusModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-[#1B2623] mb-2">Update demo workspace status</h3>
              <p className="text-xs text-[#7C857F] mb-4 leading-relaxed">
                For local demo layouts only. Live intakes use persisted workflow status from the database.
              </p>
              <div className="space-y-2 mb-6">
                {(
                  [
                    'new',
                    'additional-docs',
                    'ready-review',
                    'under-review',
                    'contacted',
                    'archived',
                    'not-pursuing',
                  ] as WorkflowStatus[]
                ).map((status) => (
                  <button
                    key={status}
                    onClick={() => handleUpdateStatus(status)}
                    className={`w-full px-4 py-3 rounded-lg text-sm font-medium text-left transition-colors ${
                      workflowStatus === status
                        ? 'bg-[#42574E] text-white'
                        : 'bg-[#FAF9F6] text-[#384039] hover:bg-[#F2F4EC]'
                    }`}
                  >
                    {getStatusLabel(status)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowStatusModal(false)}
                className="w-full bg-[#F2F4EC] text-[#1B2623] py-2.5 px-4 rounded-lg hover:bg-[#E4E5DE] transition-colors text-sm font-medium"
              >
                Cancel
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request Additional Documents (firm → worker) */}
      <AnimatePresence>
        {showFirmDocRequestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1B2623]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeFirmDocRequestModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-[#1B2623] mb-2">Request additional documents</h3>
              <p className="text-sm text-[#6A6D66] mb-4">
                Select the records your firm needs before continuing review.
              </p>
              {docReqError ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  {docReqError}
                </p>
              ) : null}
              <div className="space-y-2 mb-4 max-h-[40vh] overflow-y-auto">
                {FIRM_ADDITIONAL_DOCUMENT_CATEGORIES.map((category) => (
                  <label
                    key={category}
                    className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm cursor-pointer border transition-colors ${
                      docReqCategories.includes(category)
                        ? 'bg-[#42574E] text-white border-[#42574E]'
                        : 'bg-[#FAF9F6] text-[#384039] border-[#E4E5DE] hover:bg-[#F2F4EC]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={docReqCategories.includes(category)}
                      onChange={() => toggleDocReqCategory(category)}
                      disabled={docReqSubmitting}
                    />
                    <span
                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                        docReqCategories.includes(category) ? 'border-white bg-white' : 'border-[#CBD6CF] bg-white'
                      }`}
                    >
                      {docReqCategories.includes(category) ? (
                        <CheckCircle2 className="w-3 h-3 text-[#1B2623]" />
                      ) : null}
                    </span>
                    {polishHumanReadableDisplayText(category) || category}
                  </label>
                ))}
              </div>
              <label className="text-sm font-medium text-[#1B2623] mb-1 block">Optional note</label>
              <textarea
                value={docReqNote}
                onChange={(e) => {
                  setDocReqNote(e.target.value);
                  if (docReqError) setDocReqError(null);
                }}
                className="w-full mb-4 px-3 py-2 border border-[#E4E5DE] rounded-lg text-sm h-24 resize-none"
                placeholder="Add context for the record owner (optional)."
                disabled={docReqSubmitting}
              />
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmitDocumentRequest();
                }}
              >
                <button
                  type="submit"
                  disabled={docReqSubmitting || !onRequestAdditionalDocuments}
                  className="flex-1 bg-[#42574E] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {docReqSubmitting ? 'Sending…' : 'Send request'}
                </button>
                <button
                  type="button"
                  onClick={closeFirmDocRequestModal}
                  disabled={docReqSubmitting}
                  className="flex-1 bg-[#F2F4EC] text-[#1B2623] py-2.5 rounded-lg text-sm font-medium"
                >
                  Cancel
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <CitationPanel
        citation={openCitation}
        signedUrl={openCitation ? citationUrls[openCitation.docId] ?? null : null}
        onClose={() => setOpenCitation(null)}
      />
    </div>
  );
}
