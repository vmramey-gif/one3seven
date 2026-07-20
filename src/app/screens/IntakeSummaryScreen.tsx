import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Download,
  Mail,
  Plus,
  Save,
  Share2,
  Folder,
  FileText,
  Calendar,
  CheckCircle2,
  FileCheck,
  DollarSign,
  MessageSquare,
  Briefcase,
  Clock,
  ArrowLeft,
  Info,
  X,
  Loader2,
} from 'lucide-react';
import { Screen } from '../App';
import { IntakeWorkspace } from '../types/IntakeWorkspace';
import { BETA_ENABLE_PARTICIPATING_ROUTING, PARTICIPATING_NETWORK_LIVE } from '../constants/flags';
import {
  ONE3SEVEN_NOTICES,
  PARTICIPATING_NETWORK_COPY,
  FIRM_ROUTING_COPY,
  isParticipatingSubmissionChannel,
  isFirmCodeSubmissionChannel,
  SAMPLE_INTAKE_NUMBER,
  SAMPLE_DEMO_LABEL,
  SAMPLE_INTAKE_SUMMARY_LABEL,
  WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED,
  formatWorkerWorkflowStatusForDisplay,
  isWorkerUploadedAdditionalDocumentsWorkflow,
  linkedFirmIntakeAlreadyShared,
  linkedFirmSendButtonLabel,
  linkedFirmShareModalButtonLabel,
} from '../constants/one3sevenProduct';
import { WORKER_RECORD_HANDOFF } from '../constants/workerStoryIntake';
import {
  downloadIntakeSummaryDocument,
} from '../../services/intakeSummaryDownload';
import { STATE_BAR_SEARCH_URLS, STATE_LABELS } from '../constants/stateBarDirectories';
import {
  inferCategoryFromFileName,
  resolveAttorneyFacingUploadCategory,
  resolveUploadedFileDisplayCategory,
  type UploadedFilePersistMetaRow,
  extractWorkerIntakeNotesFromOverview,
  extractWorkerAdditionalNotesFromOverview,
  extractWorkerStoryFromOverview,
  parseWorkerIntakeNotesFromOverview,
  extractFirmDocumentRequestFromOverview,
  resolveWorkerDocumentResponse,
  isWorkerDocumentRequestResponseComplete,
  stripWorkerIntakeNotesBlock,
  fetchIntakeSummaryBundle,
  listUploadedFiles,
} from '../../services/intakeDataService';
import type { IntakeSummaryDownloadPayload } from '../../services/intakeSummaryDownload';
import { extractOrgEngineFromOverview } from '../../services/intakeOrgEngineCodec';
import { partitionReadinessForDisplay } from '../../services/readinessDiagnosticsPresentation';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { truncateFileLabel, uploadedFileKey } from '../../services/employmentTimelineOrganization';
import { NotificationsBell } from '../components/NotificationsBell';
import type { AppNotificationItem } from '../components/NotificationsBell';
import { WorkerFirmCodeSection } from '../components/WorkerFirmCodeSection';
import { ParticipatingNetworkStatusSection } from '../components/ParticipatingNetworkStatusSection';
import { WorkerExpandableSection } from '../components/WorkerExpandableSection';
import { WorkerRecordStoryBlock } from '../components/WorkerRecordStoryBlock';
import { WorkerTimelineEventCard } from '../components/WorkerTimelineEventCard';
import { WorkerFullReviewBar } from '../components/WorkerFullReviewBar';
import { IntakePacketPreview } from '../components/IntakePacketPreview';
import { buildIntakePacketViewModel } from '../../services/intakePacketPresentation';
import { WORKER_INTAKE_ACTIONS, WORKER_INTAKE_SECTIONS } from '../constants/workerIntakePresentation';
import {
  O3S_LABEL,
  O3S_NAV_ACTION,
  O3S_NAV_BRAND,
  O3S_NAV_TOP,
  O3S_PAGE,
  O3S_STATUS_PILL,
  O3S_SUBLINE,
} from '../constants/visualTheme';
import { EmploymentMatterChipList } from '../components/EmploymentMatterTagsLine';
import type { EmploymentMatterTagId } from '../constants/employmentMatter';
import {
  buildRecordStoryExcerpt,
  buildTimelineSectionMeta,
  softenWorkerReviewLine,
} from '../utils/workerIntakePresentationUtils';
import {
  buildExecutiveSummary,
  mapWorkerDashboardTimelineRows,
} from '../../services/packetStoryPresentation';
import { inferInventoryCategory } from '../../services/packetChronologyIntelligence';
import { polishHumanReadableDisplayText } from '../../services/firmIntakeDisplay';
import { extractStoryFollowUpFromOverview } from '../../services/storyFollowUpPersistence';
import { extractRecordStoryFromOverview, parseTimelineSourceTrace } from '../../services/timelineSourceTraceCodec';
import type { WorkerTimelineItem } from '../types/workerTimeline';
import { workerMobileSummarySkin } from '../utils/workerMobileSummaryPresentation';
import { WordMark } from '../components/WordMark';

function resolveWorkerFirmDocumentRequest(
  overview: string | undefined,
  missing: string[] | undefined
): { categories: string[]; note: string } | null {
  const fromOverview = extractFirmDocumentRequestFromOverview(overview);
  if (fromOverview && (fromOverview.categories.length > 0 || fromOverview.note)) {
    return fromOverview;
  }

  const categories: string[] = [];
  let note = '';
  for (const line of missing ?? []) {
    const t = line.trim();
    if (t.startsWith('Firm requested:')) {
      categories.push(t.slice('Firm requested:'.length).trim());
    } else if (t.startsWith('Firm note:')) {
      note = t.slice('Firm note:'.length).trim();
    }
  }
  if (categories.length > 0 || note) {
    return { categories, note };
  }
  return null;
}

type IntakeMaturityState = 'story_only' | 'records_only' | 'story_and_records' | 'minimal';

function hasMeaningfulWorkerStory(text: string | null | undefined): boolean {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return normalized.length >= 12 || normalized.split(/\s+/).length >= 3;
}

interface IntakeSummaryScreenProps {
  onNavigate: (screen: Screen) => void;
  /** Firm organizing its OWN case documents — swaps worker-facing framing for firm framing. */
  firmCaseMode?: boolean;
  uploadedFiles: File[];
  onLogoClick: () => void;
  intakeWorkspace: IntakeWorkspace;
  onSaveIntake: () => void;
  onSubmitToFirms?: () => void;
  liveOverview?: string;
  liveReadiness?: string[];
  liveMissing?: string[];
  liveAccessRequests?: Array<{ routeId: string; firmName: string; barNumber?: string | null; barState?: string | null }>;
  /** Timeline rows from Supabase `timeline_events` (worker summary bundle). */
  liveTimelineEvents?: WorkerTimelineItem[];
  onApproveAccess?: (routeId: string) => Promise<{ error?: string }>;
  onShareFirmCode?: (code: string) => Promise<{ error?: string; firmName?: string }>;
  onShareParticipating?: () => Promise<{ error?: string; count?: number }>;
  workerWorkflowStatus?: string | null;
  participatingRoutingActive?: boolean;
  /** Supabase intake number for downloads and labeling */
  intakeNumber?: string | null;
  /** Worker's own name/phone (profile) — printed on their own downloaded packet. */
  workerFullName?: string | null;
  workerPhone?: string | null;
  /** When set, export/download pulls fresh summary + uploaded_files names from Supabase. */
  exportIntakeId?: string | null;
  /** Timeline summary line from persisted summary (Supabase) */
  liveTimelineSummary?: string;
  /** When true, do not fall back to demo timeline or heuristic “organization notes” */
  preferLiveDataOnly?: boolean;
  /** intakes.submission_channel from Supabase */
  submissionChannel?: string | null;
  /** Persisted firm_profiles.firm_name when linked_firm_id is set */
  connectedFirmName?: string | null;
  /** Persisted firm_profiles.firm_code when linked_firm_id is set */
  connectedFirmCode?: string | null;
  connectedRouteStatus?: string | null;
  connectedRouteSharedAt?: string | null;
  firmCodeActionBusy?: boolean;
  firmCodeActionError?: string | null;
  onAddFirmCode?: () => void;
  onRemoveFirmCode?: () => Promise<{ error?: string } | void>;
  openFirmCodeModalSignal?: number;
  /** Primary back target after summary (worker dashboard) */
  backScreen?: Screen;
  onOpenWorkerSettings?: () => void;
  onWorkerSignOut?: () => void;
  /** After successful Firm Code or Participating routing */
  onAfterRoutingSuccess?: (detail: {
    kind: 'firm_code' | 'participating';
    firmName?: string | null;
    participatingRouteCount?: number;
  }) => void;
  /** Persist worker email modal note (no live email delivery in beta) */
  onEmailActivitySaved?: (detail: { email: string; note: string }) => void;
  /** When true, show labeled demo watermark on summary */
  showDemoSampleWatermark?: boolean;
  /** When incremented, scrolls this screen to the intake-notes panel (dashboard handoff). */
  intakeNotesScrollSignal?: number;
  /** Scroll to firm full-access approval section (notification deep-link). */
  accessApprovalScrollSignal?: number;
  onSaveWorkerIntakeNotes?: (notes: string) => Promise<{ error?: string }>;
  workerBellNotifications?: AppNotificationItem[];
  notificationsPanelNotice?: string;
  uploadedFileLabels?: Record<string, string>;
  onUploadedFileLabelChange?: (fileKey: string, label: string) => void;
  onRemoveUploadedFile?: (index: number) => void;
  uploadedFilePersistMeta?: Array<UploadedFilePersistMetaRow | null>;
  onConfirmDocumentRequestResponse?: (payload: {
    fulfilledCategories: string[];
    noteToFirm: string;
  }) => Promise<{ error?: string }>;
  documentResponseDraft?: { fulfilled: string[]; note: string; updatedAt?: string } | null;
  onDocumentResponseDraftChange?: (draft: {
    fulfilled: string[];
    note: string;
  }) => Promise<void>;
  /** From persistent firm_document_request notification (fallback before summary sync). */
  documentRequestPayload?: {
    requested_categories: string[];
    firm_note: string;
    firm_name: string;
  } | null;
  /** After doc-request upload processing, scroll to the confirm-response block. */
  docRequestConfirmScrollSignal?: number;
  /** Guided Step 2 narrative before merge, or persisted story from summary. */
  workerStoryPreview?: string | null;
  employmentMatterTags?: EmploymentMatterTagId[];
  /** Worker's selected case category — drives the records-handoff guidance (employment vs. PI). */
  caseCategory?: string | null;
  shellMode?: boolean;
}

function TruncatedNameButton({ fullName, display }: { fullName: string; display: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-[#1B2623] hover:text-[#384039] underline decoration-[#CBD6CF] underline-offset-2"
        title="View full file name"
      >
        {display}
      </button>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/30"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ scale: 0.98, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            className="w-full max-w-sm rounded-[14px] border border-[#E4E5DE] bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold text-[#7C857F] uppercase tracking-wide mb-2">Full file name</p>
            <p className="text-sm text-[#1B2623] break-all leading-relaxed">{fullName}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-4 w-full text-sm font-medium py-2.5 rounded-[12px] bg-[#42574E] text-white hover:bg-[#42574E]"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </>
  );
}

export function IntakeSummaryScreen({
  onNavigate,
  firmCaseMode = false,
  uploadedFiles,
  onLogoClick,
  intakeWorkspace,
  onSaveIntake,
  onSubmitToFirms,
  liveOverview,
  liveReadiness,
  liveMissing,
  liveAccessRequests,
  onApproveAccess,
  onShareFirmCode,
  onShareParticipating,
  workerWorkflowStatus,
  participatingRoutingActive,
  intakeNumber,
  workerFullName,
  workerPhone,
  exportIntakeId,
  liveTimelineSummary,
  liveTimelineEvents = [],
  preferLiveDataOnly,
  submissionChannel,
  connectedFirmName,
  connectedFirmCode,
  connectedRouteStatus,
  connectedRouteSharedAt,
  firmCodeActionBusy = false,
  firmCodeActionError = null,
  onAddFirmCode,
  onRemoveFirmCode,
  openFirmCodeModalSignal,
  backScreen = 'landing',
  onOpenWorkerSettings,
  onWorkerSignOut,
  onAfterRoutingSuccess,
  onEmailActivitySaved,
  showDemoSampleWatermark,
  workerBellNotifications = [],
  notificationsPanelNotice,
  intakeNotesScrollSignal = 0,
  accessApprovalScrollSignal = 0,
  onSaveWorkerIntakeNotes,
  uploadedFileLabels = {},
  onUploadedFileLabelChange,
  onRemoveUploadedFile,
  uploadedFilePersistMeta = [],
  onConfirmDocumentRequestResponse,
  documentResponseDraft = null,
  onDocumentResponseDraftChange,
  documentRequestPayload,
  docRequestConfirmScrollSignal = 0,
  workerStoryPreview = null,
  employmentMatterTags = [],
  caseCategory = null,
  shellMode = false,
}: IntakeSummaryScreenProps) {
  const [showEmailModal, setShowEmailModal] = useState(false);
  // Worker-directed model: firm-code / direct routing (worker sends to a firm they choose)
  // stays available; the participating-firm NETWORK broadcast is gated by the central flag
  // PARTICIPATING_NETWORK_LIVE (off pending counsel — see flags.ts).
  const PARTICIPATING_ROUTING_LIVE = PARTICIPATING_NETWORK_LIVE;
  const [showShareModal, setShowShareModal] = useState(false);
  const [concernsAcknowledged, setConcernsAcknowledged] = useState<boolean | null>(null);
  const [routingSubpanel, setRoutingSubpanel] = useState<'menu' | 'firm_code'>('menu');
  const [firmCodeInput, setFirmCodeInput] = useState('');
  const [shareApiError, setShareApiError] = useState('');
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [showShareConfirmation, setShowShareConfirmation] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [intakeNotesOpen, setIntakeNotesOpen] = useState(false);
  const [intakeNoteDraft, setIntakeNoteDraft] = useState('');
  const [intakeNoteSaving, setIntakeNoteSaving] = useState(false);
  const [intakeNoteMessage, setIntakeNoteMessage] = useState<string | null>(null);
  const [editingFileKey, setEditingFileKey] = useState<string | null>(null);
  const [editingFileLabel, setEditingFileLabel] = useState('');
  const [accessApprovalMessage, setAccessApprovalMessage] = useState<string | null>(null);
  const [accessApprovalError, setAccessApprovalError] = useState<string | null>(null);
  const [accessApprovalErrorRouteId, setAccessApprovalErrorRouteId] = useState<string | null>(null);
  const [accessApprovalBusyRouteId, setAccessApprovalBusyRouteId] = useState<string | null>(null);
  const [fulfilledDraft, setFulfilledDraft] = useState<string[]>([]);
  const [noteToFirmDraft, setNoteToFirmDraft] = useState('');
  const [docConfirmError, setDocConfirmError] = useState<string | null>(null);
  const [docConfirmBusy, setDocConfirmBusy] = useState(false);
  const [docDraftSaveMessage, setDocDraftSaveMessage] = useState<string | null>(null);
  const [docDraftSaveError, setDocDraftSaveError] = useState<string | null>(null);
  const [docDraftSaving, setDocDraftSaving] = useState(false);
  const [fullReviewMode, setFullReviewMode] = useState(false);
  const [showAllUploadedFiles, setShowAllUploadedFiles] = useState(false);

  const sx = workerMobileSummarySkin(shellMode);
  const expandableTitleClass = sx.expandableTitle || undefined;

  const firmDocRequest = useMemo(() => {
    const fromPayload = documentRequestPayload
      ? {
          categories: (documentRequestPayload.requested_categories ?? []).map((c) => c.trim()).filter(Boolean),
          note: (documentRequestPayload.firm_note ?? '').trim(),
          firmName: (documentRequestPayload.firm_name ?? '').trim() || null,
        }
      : null;
    if (fromPayload && (fromPayload.categories.length > 0 || fromPayload.note)) {
      return fromPayload;
    }
    const fromSummary = resolveWorkerFirmDocumentRequest(liveOverview, liveMissing);
    if (fromSummary) {
      return { ...fromSummary, firmName: null as string | null };
    }
    return null;
  }, [documentRequestPayload, liveOverview, liveMissing]);
  const workerDocResponse = useMemo(
    () => resolveWorkerDocumentResponse(liveOverview, liveMissing),
    [liveOverview, liveMissing]
  );

  const workflowStatusExact = (workerWorkflowStatus ?? '').trim();
  const hasPersistedWorkerResponse = Boolean(
    workerDocResponse && workerDocResponse.fulfilled.length > 0
  );
  const workflowDocRequestPending =
    workflowStatusExact === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED;
  const workflowDocRequestCompleted = isWorkerDocumentRequestResponseComplete(
    workflowStatusExact,
    workerDocResponse
  );
  const workflowResponseMismatch =
    isWorkerUploadedAdditionalDocumentsWorkflow(workflowStatusExact) && !hasPersistedWorkerResponse;
  const hasFirmDocRequestDetails = Boolean(
    firmDocRequest && (firmDocRequest.categories.length > 0 || firmDocRequest.note)
  );
  const showDocRequestConfirmation =
    workflowDocRequestPending &&
    !hasPersistedWorkerResponse &&
    Boolean(onConfirmDocumentRequestResponse) &&
    hasFirmDocRequestDetails;
  const showFirmDocRequestSection =
    hasFirmDocRequestDetails &&
    (workflowDocRequestPending || workflowDocRequestCompleted || workflowResponseMismatch);

  const parsedWorkerNotes = useMemo(
    () => parseWorkerIntakeNotesFromOverview(liveOverview ?? ''),
    [liveOverview]
  );
  const persistedStory = parsedWorkerNotes.workerStory;
  const workerStoryDisplay =
    polishHumanReadableDisplayText(persistedStory ?? workerStoryPreview ?? '') || null;
  const guidedSelectionsDisplay = polishHumanReadableDisplayText(parsedWorkerNotes.guidedSummary);
  const storyFollowUpDetails = useMemo(
    () => extractStoryFollowUpFromOverview(liveOverview ?? ''),
    [liveOverview]
  );
  const savedAdditionalNotesRaw = parsedWorkerNotes.additionalNotes ?? '';
  const savedAdditionalNotesDisplay = polishHumanReadableDisplayText(savedAdditionalNotesRaw);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!documentResponseDraft) {
      setFulfilledDraft([]);
      setNoteToFirmDraft('');
      return;
    }
    setFulfilledDraft(documentResponseDraft.fulfilled);
    setNoteToFirmDraft(documentResponseDraft.note ?? '');
  }, [documentResponseDraft]);

  const persistDocumentResponseDraft = (nextFulfilled: string[], nextNote: string) => {
    if (!onDocumentResponseDraftChange) return;
    setDocDraftSaveError(null);
    setDocDraftSaving(true);
    void (async () => {
      try {
        await onDocumentResponseDraftChange({
          fulfilled: nextFulfilled,
          note: nextNote,
        });
        setDocDraftSaveMessage('Selections saved.');
        window.setTimeout(() => setDocDraftSaveMessage(null), 2600);
      } catch (e) {
        setDocDraftSaveError(
          e instanceof Error ? e.message : 'Could not save your selections. Try again.'
        );
      } finally {
        setDocDraftSaving(false);
      }
    })();
  };

  const noteDraftPersistTimerRef = useRef<number | null>(null);
  const persistDocumentResponseNoteDraft = (nextFulfilled: string[], nextNote: string) => {
    if (!onDocumentResponseDraftChange) return;
    if (noteDraftPersistTimerRef.current) window.clearTimeout(noteDraftPersistTimerRef.current);
    noteDraftPersistTimerRef.current = window.setTimeout(() => {
      persistDocumentResponseDraft(nextFulfilled, nextNote);
    }, 400);
  };

  useEffect(() => {
    if (!intakeNotesScrollSignal) return;
    setIntakeNotesOpen(true);
    setIntakeNoteDraft(extractWorkerAdditionalNotesFromOverview(liveOverview ?? '') ?? '');
    requestAnimationFrame(() => {
      const targetId = workerStoryDisplay ? 'worker-story-context-section' : 'worker-intake-notes-section';
      document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [intakeNotesScrollSignal]);

  useEffect(() => {
    if (!accessApprovalScrollSignal) return;
    // Close summary modals so firm-access approval is not trapped under a dimmed backdrop.
    setShowEmailModal(false);
    setShowShareModal(false);
    setIsSending(false);
    setIsSharing(false);
    window.requestAnimationFrame(() => {
      const target = document.getElementById('firm-access-approval-top');
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      target?.focus({ preventScroll: true });
    });
  }, [accessApprovalScrollSignal]);

  useEffect(() => {
    if (!openFirmCodeModalSignal) return;
    setShareApiError('');
    setFirmCodeInput('');
    setRoutingSubpanel('firm_code');
    setShowShareModal(true);
  }, [openFirmCodeModalSignal]);

  useEffect(() => {
    if (!docRequestConfirmScrollSignal || !showDocRequestConfirmation) return;
    requestAnimationFrame(() => {
      document
        .getElementById('worker-doc-request-confirm')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [docRequestConfirmScrollSignal, showDocRequestConfirmation]);

  useEffect(() => {
    if (!intakeNotesOpen && onSaveWorkerIntakeNotes) {
      setIntakeNoteDraft(savedAdditionalNotesRaw);
    }
  }, [liveOverview, intakeNotesOpen, onSaveWorkerIntakeNotes, savedAdditionalNotesRaw]);

  // Categorize uploaded files using the same rules as initial persisted upload tags (matches Supabase uploaded_files.category).
  const categorizeFiles = () => {
    const categories: Record<string, { count: number; detected: boolean }> = {};
    uploadedFiles.forEach((file, index) => {
      const label = resolveAttorneyFacingUploadCategory(
        file.name,
        uploadedFilePersistMeta[index]?.category
      );
      if (!categories[label]) categories[label] = { count: 0, detected: false };
      categories[label].count++;
      categories[label].detected = true;
    });
    return categories;
  };

  const detectedCategories = categorizeFiles();
  const detectedCategoryCount = Object.values(detectedCategories).filter(c => c.detected).length;

  // Handler functions
  const buildSummaryDownloadPayload = (): IntakeSummaryDownloadPayload => {
    const n = (intakeNumber ?? '').trim() || 'Intake';
    const categories = Array.from(
      new Set(
        uploadedFiles.map((f, i) =>
          resolveUploadedFileDisplayCategory(f, { persistedCategory: uploadedFilePersistMeta[i]?.category })
        )
      )
    );
    const liveOv = liveOverview ?? intakeWorkspace.intakeSummary?.overview ?? '';
    const orgEngine = extractOrgEngineFromOverview(liveOv);
    const intakeNotesExtracted = extractWorkerIntakeNotesFromOverview(liveOv);
    const overviewStripped = stripWorkerIntakeNotesBlock(liveOv).trim() || '—';
    const workerCtxParts = [
      [intakeWorkspace.workerContext.mainContext, intakeWorkspace.workerContext.additionalNotes].filter(Boolean).join('\n\n'),
    ];
    if (intakeNotesExtracted) {
      workerCtxParts.push(`Worker describes (intake notes):\n${intakeNotesExtracted}`);
    }
    const workerCtx = workerCtxParts.filter(Boolean).join('\n\n');
    const timelineLine = (liveTimelineSummary ?? '').trim() || '';
    const categoryBreakdown = Object.entries(detectedCategories)
      .filter(([, data]) => data.count > 0)
      .map(([name, data]) => ({ name, count: data.count }));
    const uploadedFileInventory = uploadedFiles.map((f, i) => {
      const persisted = uploadedFilePersistMeta[i]?.category;
      const stored = resolveUploadedFileDisplayCategory(f, { persistedCategory: persisted });
      return {
        fileName: f.name,
        category: inferInventoryCategory(f.name, stored),
      };
    });
    return {
      intakeNumber: n,
      workerName: (workerFullName ?? '').trim() || undefined,
      workerPhone: (workerPhone ?? '').trim() || undefined,
      employerName: undefined,
      firmCode: (connectedFirmCode ?? '').trim() || undefined,
      intakeStatus: (workerWorkflowStatus ?? '').trim() || 'In review',
      overview: overviewStripped,
      timelineSummary: timelineLine || '—',
      timelineEvents: liveTimelineEvents.map((t) => ({
        date: t.date,
        title: t.event,
        category: t.category,
        summary: t.summary,
        sourceDates: t.sourceDates,
      })),
      workerContext: workerCtx,
      categories: categories.length ? categories : ['—'],
      categoryBreakdown,
      uploadedFileInventory,
      documentsUploaded: uploadedFiles.length,
      readiness: liveReadiness ?? [],
      missing: liveMissing ?? [],
      disclaimer: ONE3SEVEN_NOTICES.positioning,
      orgSections: orgEngine?.sections,
    };
  };

  const loadFreshExportPayloadFields = async (
    intakeId: string,
    base: IntakeSummaryDownloadPayload
  ): Promise<IntakeSummaryDownloadPayload> => {
    const [bundle, fileRows] = await Promise.all([
      fetchIntakeSummaryBundle(intakeId),
      listUploadedFiles(intakeId),
    ]);
    const s = bundle.summary as {
      overview?: string;
      timeline_summary?: string;
      readiness_indicators?: string[];
      missing_document_alerts?: string[];
    } | null;
    const overviewStripped =
      stripWorkerIntakeNotesBlock((s?.overview as string) ?? '').trim() || base.overview;
    const timelineEvents = ((bundle.events ?? []) as Array<{
      event_date: string;
      title: string;
      category: string;
      ai_summary: string;
      worker_context?: string | null;
    }>).map((e) => {
      const trace = parseTimelineSourceTrace(e.worker_context);
      return {
        date: e.event_date,
        title: e.title,
        category: e.category,
        summary: e.ai_summary,
        sourceDates: trace?.sourceDates ?? [],
      };
    });
    const uploadedFileInventory = fileRows.map((row) => {
      const fileName =
        typeof row.file_name === 'string' && row.file_name.trim() ? row.file_name : 'Uploaded file';
      const category =
        (row.category as string | null)?.trim() || inferCategoryFromFileName(fileName);
      return { fileName, category };
    });
    const catCounts = new Map<string, number>();
    for (const row of uploadedFileInventory) {
      catCounts.set(row.category, (catCounts.get(row.category) ?? 0) + 1);
    }
    const categoryBreakdown = [...catCounts.entries()].map(([name, count]) => ({ name, count }));
    const categories = uploadedFileInventory.length
      ? [...new Set(uploadedFileInventory.map((f) => f.category))]
      : base.categories;
    return {
      ...base,
      overview: overviewStripped,
      timelineSummary: ((s?.timeline_summary as string) ?? '').trim() || base.timelineSummary,
      timelineEvents: timelineEvents.length ? timelineEvents : base.timelineEvents,
      readiness: (s?.readiness_indicators as string[] | undefined) ?? base.readiness,
      missing: (s?.missing_document_alerts as string[] | undefined) ?? base.missing,
      uploadedFileInventory,
      documentsUploaded: fileRows.length || base.documentsUploaded,
      categories,
      categoryBreakdown: categoryBreakdown.length ? categoryBreakdown : base.categoryBreakdown,
    };
  };

  const handleDownloadIntakeSummary = async () => {
    let payload = buildSummaryDownloadPayload();
    const intakeId = (exportIntakeId ?? '').trim();
    if (intakeId && isSupabaseConfigured()) {
      try {
        payload = await loadFreshExportPayloadFields(intakeId, payload);
      } catch (e) {
        console.error('[o3s-export] fresh export payload failed', e);
      }
    }
    await downloadIntakeSummaryDocument(payload);
  };

  const handleSaveForLater = async () => {
    // Save the intake workspace
    onSaveIntake();
    await new Promise((resolve) => setTimeout(resolve, 800));
    setShowSaveConfirmation(true);
    setTimeout(() => setShowSaveConfirmation(false), 3000);
  };

  const handleEmailSubmit = async () => {
    if (!emailAddress.trim()) return;

    setIsSending(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    onEmailActivitySaved?.({ email: emailAddress.trim(), note: emailNote.trim() });
    setIsSending(false);
    setShowEmailModal(false);
    setShowEmailConfirmation(true);
    setEmailAddress('');
    setEmailNote('');
    setTimeout(() => setShowEmailConfirmation(false), 5000);
  };

  const handleParticipatingShare = async () => {
    if (!onShareParticipating) return;
    setShareApiError('');
    setIsSharing(true);
    try {
      const r = await onShareParticipating();
      if (r?.error) {
        setShareApiError(r.error);
        return;
      }
      const count = r?.count ?? 0;
      if (count < 1) {
        setShareApiError(PARTICIPATING_NETWORK_COPY.zeroRoutesAvailable);
        return;
      }
      setShowShareModal(false);
      setRoutingSubpanel('menu');
      if (onAfterRoutingSuccess) {
        onAfterRoutingSuccess({
          kind: 'participating',
          firmName: null,
          participatingRouteCount: count,
        });
      } else {
        setShowShareConfirmation(true);
        setTimeout(() => setShowShareConfirmation(false), 4000);
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareSubmit = async () => {
    if (onShareParticipating) {
      await handleParticipatingShare();
      return;
    }
    if (!onSubmitToFirms) {
      setShareApiError('Sharing requires a connected Supabase workspace.');
      return;
    }
    setShareApiError('');
    setIsSharing(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      onSubmitToFirms();
      setShowShareModal(false);
      setShowShareConfirmation(true);
      setTimeout(() => setShowShareConfirmation(false), 4000);
    } finally {
      setIsSharing(false);
    }
  };

  const handleFirmCodeShare = async () => {
    if (!onShareFirmCode || !firmCodeInput.trim()) return;
    setShareApiError('');
    setIsSharing(true);
    const r = await onShareFirmCode(firmCodeInput.trim());
    setIsSharing(false);
    if (r?.error) setShareApiError(r.error);
    else {
      setShowShareModal(false);
      setRoutingSubpanel('menu');
      setFirmCodeInput('');
      if (onAfterRoutingSuccess) onAfterRoutingSuccess({ kind: 'firm_code', firmName: r?.firmName ?? null, participatingRouteCount: undefined });
      else {
        setShowShareConfirmation(true);
        setTimeout(() => setShowShareConfirmation(false), 4000);
      }
    }
  };

  const handleSendToLinkedFirm = async () => {
    if (!onShareFirmCode || !connectedFirmCode) return;
    setShareApiError('');
    setIsSharing(true);
    const r = await onShareFirmCode(connectedFirmCode);
    setIsSharing(false);
    if (r?.error) {
      setShareApiError(r.error);
      return;
    }
    if (onAfterRoutingSuccess) {
      onAfterRoutingSuccess({
        kind: 'firm_code',
        firmName: r?.firmName ?? connectedFirmName ?? null,
        participatingRouteCount: undefined,
      });
    } else {
      setShowShareConfirmation(true);
      setTimeout(() => setShowShareConfirmation(false), 4000);
    }
  };

  const handleSaveIntakeNotes = async () => {
    if (!onSaveWorkerIntakeNotes) return;
    setIntakeNoteMessage(null);
    setIntakeNoteSaving(true);
    const r = await onSaveWorkerIntakeNotes(intakeNoteDraft);
    setIntakeNoteSaving(false);
    if (r?.error) setIntakeNoteMessage(r.error);
    else {
      setIntakeNoteMessage('Saved to your intake summary.');
      setTimeout(() => setIntakeNoteMessage(null), 4000);
    }
  };

  const summaryDownloadPayload = useMemo(
    () => buildSummaryDownloadPayload(),
    [
      intakeNumber,
      liveOverview,
      liveTimelineSummary,
      liveTimelineEvents,
      liveReadiness,
      liveMissing,
      uploadedFiles,
      uploadedFilePersistMeta,
      intakeWorkspace.intakeSummary?.overview,
      intakeWorkspace.workerContext.mainContext,
      intakeWorkspace.workerContext.additionalNotes,
    ]
  );
  const executiveSummary = useMemo(
    () => buildExecutiveSummary(summaryDownloadPayload),
    [summaryDownloadPayload]
  );

  const packetPreviewModel = useMemo(
    () => buildIntakePacketViewModel(summaryDownloadPayload),
    [summaryDownloadPayload]
  );

  const recordStoryExcerpt = useMemo(() => {
    if (executiveSummary.trim()) return executiveSummary;
    const fromGeneration = extractRecordStoryFromOverview(liveOverview ?? '');
    if (fromGeneration) {
      return buildRecordStoryExcerpt({
        intakeAtAGlance: fromGeneration,
        chronologyOverview: '',
        reviewFocusAreas: [],
        recordCompleteness: [],
      });
    }
    return '';
  }, [executiveSummary, liveOverview]);

  const displayTimelineEvents = useMemo(
    () => mapWorkerDashboardTimelineRows(summaryDownloadPayload),
    [summaryDownloadPayload]
  );

  const timelineSectionMeta = useMemo(
    () => buildTimelineSectionMeta(displayTimelineEvents),
    [displayTimelineEvents]
  );

  const readinessPresentation = useMemo(
    () => partitionReadinessForDisplay(liveReadiness ?? []),
    [liveReadiness]
  );

  const UPLOADED_FILES_PREVIEW = 3;

  const categoryIcons: Record<string, typeof FileText> = {
    'Pay Records / Payroll': DollarSign,
    'Pay Records': DollarSign,
    'Time Records': Clock,
    'Workplace Communications': MessageSquare,
    'Offer Letters': Briefcase,
    'PTO Records': Calendar,
    'HR Documents': FileText,
    'Reimbursement Records': DollarSign,
    'Performance Reviews': FileCheck,
    Uncategorized: FileText,
  };

  // Filter to only detected categories
  const detectedCategoriesArray = Object.entries(detectedCategories)
    .filter(([_, data]) => data.detected)
    .map(([name, data]) => ({
      name,
      count: data.count,
      icon: categoryIcons[name] || FileText,
    }));

  const hasLiveDocSignals =
    Boolean(stripWorkerIntakeNotesBlock(liveOverview ?? '').trim()) || Boolean(liveReadiness?.length);

  const hasLinkedFirm = Boolean((connectedFirmCode ?? '').trim());
  const canRouteFirmCode = Boolean(onShareFirmCode);
  // PARTICIPATING_ROUTING_LIVE is the single master switch for the participating-firm
  // network. While it is false, no participating surface renders anywhere on this screen
  // (button, share-modal option, or explainer section) — firm-code routing stays live.
  const canRouteParticipating = PARTICIPATING_ROUTING_LIVE && Boolean(onShareParticipating);
  const linkedFirmAlreadyShared = linkedFirmIntakeAlreadyShared(connectedRouteStatus);
  const participatingPreviewActive =
    isParticipatingSubmissionChannel(submissionChannel) ||
    (participatingRoutingActive && !hasLinkedFirm);
  const canSendToLinkedFirm =
    preferLiveDataOnly &&
    Boolean(onShareFirmCode) &&
    hasLinkedFirm &&
    hasLiveDocSignals;
  const linkedFirmSendLabel = linkedFirmSendButtonLabel(connectedFirmName, linkedFirmAlreadyShared);
  const canShareSummary =
    canSendToLinkedFirm ||
    canRouteFirmCode ||
    canRouteParticipating ||
    (!preferLiveDataOnly && Boolean(onSubmitToFirms));

  const pendingAccessRequests =
    liveAccessRequests && liveAccessRequests.length > 0 && onApproveAccess ? liveAccessRequests : null;

  const recordSignalCount = Math.max(
    uploadedFiles.length,
    detectedCategoriesArray.reduce((sum, category) => sum + category.count, 0)
  );
  const hasMeaningfulStory =
    hasMeaningfulWorkerStory(workerStoryDisplay) ||
    hasMeaningfulWorkerStory(intakeWorkspace.workerContext.mainContext);
  const intakeMaturityState: IntakeMaturityState =
    hasMeaningfulStory && recordSignalCount > 0
      ? 'story_and_records'
      : hasMeaningfulStory
        ? 'story_only'
        : recordSignalCount > 0
          ? 'records_only'
          : 'minimal';
  const maturityMessage: Record<IntakeMaturityState, string> = {
    story_only: 'We organized your story. Supporting records may help strengthen the timeline.',
    records_only: 'We organized your records. Additional context may help create a more complete summary.',
    story_and_records: 'Your story and records have been organized into a timeline and summary.',
    minimal:
      "We've started organizing what you shared. Even a few sentences about what happened helps — and you can add records like pay stubs, emails, or letters whenever you find them.",
  };

  // Records-handoff guidance (Personal Injury vs. employment). Names the attorney type only —
  // no legal conclusion. Injury line shows for a Personal Injury intake; employment line shows
  // for employment intakes (the beta default) or whenever employment matter tags are present;
  // the "more than one" note shows only when both apply.
  const showInjuryHandoff = (caseCategory ?? '').trim() === 'Personal Injury';
  const showEmploymentHandoff = !showInjuryHandoff || employmentMatterTags.length > 0;
  const showBothHandoffNote = showInjuryHandoff && showEmploymentHandoff;

  const organizedSummaryParagraphs = useMemo(() => {
    const text = intakeMaturityState === 'minimal' ? '' : recordStoryExcerpt.trim();
    if (!text) return [];
    return text
      .split(/\n{2,}/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3);
  }, [intakeMaturityState, recordStoryExcerpt]);

  const missingInformationItems = useMemo(() => {
    const seen = new Set<string>();
    const dedup = (item: string) => {
      const t = item.trim();
      if (!t) return '';
      const key = t.toLowerCase();
      if (seen.has(key)) return '';
      seen.add(key);
      return t;
    };
    const missing = (liveMissing ?? []).map(softenWorkerReviewLine).map(dedup).filter(Boolean);
    const supplemental = readinessPresentation.supplementalBrief.map(softenWorkerReviewLine).map(dedup).filter(Boolean);
    return [...missing, ...supplemental].slice(0, 4);
  }, [liveMissing, readinessPresentation.supplementalBrief]);

  const confidenceItems = useMemo(() => {
    const timelineDetail =
      displayTimelineEvents.length > 0
        ? `${displayTimelineEvents.length} key event${displayTimelineEvents.length === 1 ? '' : 's'} organized.`
        : 'No timeline events are available yet.';
    const recordsDetail =
      recordSignalCount > 0
        ? `${recordSignalCount} record${recordSignalCount === 1 ? '' : 's'} included.`
        : 'Records can be added later.';
    const hasPeople = Boolean(storyFollowUpDetails?.keyPeople?.trim());
    const hasDateGap = missingInformationItems.some((item) => /date|when|timing/i.test(item));

    if (intakeMaturityState === 'records_only') {
      return [
        { label: 'Records Organized', complete: true, detail: recordsDetail },
        {
          label: displayTimelineEvents.length > 0 ? 'Initial Timeline Created' : 'Initial Timeline Not Started',
          complete: displayTimelineEvents.length > 0,
          detail: timelineDetail,
        },
        { label: 'Story Not Yet Provided', complete: false, detail: 'Additional context may help complete the summary.' },
        ...(hasDateGap
          ? [{ label: 'Key Dates Not Yet Clear', complete: false, detail: 'Dates can be clarified when available.' }]
          : []),
        ...(hasPeople
          ? [{ label: 'People Identified', complete: true, detail: 'People or roles were included in your intake details.' }]
          : [{ label: 'People Not Yet Identified', complete: false, detail: 'People can be added when known.' }]),
      ];
    }

    if (intakeMaturityState === 'story_only') {
      return [
        { label: 'Story Organized', complete: true, detail: 'Your story is part of this summary.' },
        { label: 'Supporting Records Not Yet Added', complete: false, detail: 'Records can be added later.' },
        {
          label: displayTimelineEvents.length > 0 ? 'Timeline Started' : 'Timeline Not Started',
          complete: displayTimelineEvents.length > 0,
          detail: timelineDetail,
        },
        ...(hasPeople
          ? [{ label: 'People Identified', complete: true, detail: 'People or roles were included in your intake details.' }]
          : []),
      ];
    }

    if (intakeMaturityState === 'minimal') {
      return [
        { label: 'Story Needed', complete: false, detail: 'A few sentences can help one3seven organize the intake.' },
        { label: 'Records Optional', complete: false, detail: 'You can begin with story or records.' },
        { label: 'Timeline Not Started', complete: false, detail: 'A timeline can be created once more information is available.' },
      ];
    }

    return [
      { label: 'Story Organized', complete: true, detail: 'Your story is part of this summary.' },
      { label: 'Timeline Created', complete: displayTimelineEvents.length > 0, detail: timelineDetail },
      { label: 'Supporting Records Found', complete: recordSignalCount > 0, detail: recordsDetail },
      ...(hasPeople
        ? [{ label: 'People Identified', complete: true, detail: 'People or roles were included in your intake details.' }]
        : []),
    ];
  }, [
    displayTimelineEvents.length,
    intakeMaturityState,
    missingInformationItems,
    recordSignalCount,
    storyFollowUpDetails?.keyPeople,
  ]);

  const nextRecommendedAction = useMemo(() => {
    if (showDocRequestConfirmation) return 'Upload the records your firm requested, then confirm what you sent.';
    if (pendingAccessRequests) return 'Review the firm access request when you are ready.';
    if (intakeMaturityState === 'minimal') return 'Add a short story or upload records to create a more useful summary.';
    if (intakeMaturityState === 'records_only') return 'Your records are organized. Adding a brief story or context can help complete the summary.';
    if (intakeMaturityState === 'story_only') return 'Upload supporting records when you have them.';
    if (missingInformationItems.length > 0) return 'Review the missing information list and add details if you have them.';
    if (canShareSummary) return 'Share your organized summary when you are ready.';
    return 'Review your organized summary and keep it updated as needed.';
  }, [
    canShareSummary,
    intakeMaturityState,
    missingInformationItems.length,
    pendingAccessRequests,
    showDocRequestConfirmation,
  ]);

  const handleApproveAccess = async (routeId: string) => {
    if (!onApproveAccess) return;
    setAccessApprovalBusyRouteId(routeId);
    setAccessApprovalError(null);
    setAccessApprovalErrorRouteId(null);
    setAccessApprovalMessage(null);
    const r = await onApproveAccess(routeId);
    setAccessApprovalBusyRouteId(null);
    if (r.error) {
      setAccessApprovalError(r.error);
      setAccessApprovalErrorRouteId(routeId);
      return;
    }
    setAccessApprovalMessage(PARTICIPATING_NETWORK_COPY.accessApproved);
  };

  return (
    <div className={sx.root}>
      {(showDemoSampleWatermark || intakeNumber === SAMPLE_INTAKE_NUMBER) && (
        <div className="bg-amber-50 border-b border-amber-100 px-6 py-2.5 text-center text-xs text-amber-950">
          <strong>{SAMPLE_INTAKE_SUMMARY_LABEL}</strong> · {SAMPLE_DEMO_LABEL} · Sample initials: V.R.
        </div>
      )}
      {/* Header */}
      {!shellMode ? (
      <header className={O3S_NAV_TOP}>
        <div className="px-6 py-4 flex items-center justify-between gap-3">
          <button type="button" onClick={onLogoClick} className={O3S_NAV_BRAND}>
            <WordMark />
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            <NotificationsBell items={workerBellNotifications} panelNotice={notificationsPanelNotice} />
            {onOpenWorkerSettings ? (
              <button type="button" onClick={onOpenWorkerSettings} className={O3S_NAV_ACTION}>
                Settings
              </button>
            ) : null}
            {onWorkerSignOut ? (
              <button type="button" onClick={onWorkerSignOut} className={O3S_NAV_ACTION}>
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </header>
      ) : null}

      {/* Content */}
      <div className={`${sx.content(fullReviewMode)} ${sx.skin}`}>
        {/* Back Navigation */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-6">
          <button
            type="button"
            onClick={() => onNavigate(backScreen)}
            className={sx.back}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to your dashboard
          </button>
        </div>

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="px-4 sm:px-6 pt-4 pb-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div className="min-w-0">
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className={sx.pageTitle}>
                {shellMode ? (
                  <>
                    <span className="sm:hidden">{firmCaseMode ? 'Case file organized' : 'Your summary'}</span>
                    <span className="hidden sm:inline">{firmCaseMode ? 'Case file organized' : 'Your summary'}</span>
                  </>
                ) : (
                  firmCaseMode ? 'Case file organized' : 'Your summary'
                )}
              </h1>
              {intakeNumber ? (
                <p className={sx.intakeMeta}>{intakeNumber}</p>
              ) : null}
            </div>
            {workerWorkflowStatus ? (
              <span className={`${O3S_STATUS_PILL} ${sx.statusWrap}`}>
                {formatWorkerWorkflowStatusForDisplay(workerWorkflowStatus, submissionChannel)}
              </span>
            ) : null}
          </div>

          <div className="mb-4 rounded-[18px] border border-[#CBD6CF] bg-white/90 p-3 shadow-[0_14px_36px_rgba(91,53,213,0.08)]">
            <p className="mb-3 text-sm leading-relaxed text-[#1B2623]/72">
              This is the organized summary one3seven created from your story and records.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-[14px] bg-[#F7F9F5] p-1">
              <button
                type="button"
                onClick={() => setFullReviewMode(false)}
                className={`rounded-[12px] px-3 py-2.5 text-xs font-semibold transition ${
                  !fullReviewMode
                    ? 'bg-white text-[#374A42] shadow-sm'
                    : 'text-[#40433F] hover:bg-white/60'
                }`}
              >
                What Firms See
              </button>
              <button
                type="button"
                onClick={() => setFullReviewMode(true)}
                className={`rounded-[12px] px-3 py-2.5 text-xs font-semibold transition ${
                  fullReviewMode
                    ? 'bg-white text-[#374A42] shadow-sm'
                    : 'text-[#40433F] hover:bg-white/60'
                }`}
              >
                Full Review Version
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-[#40433F]">
              {fullReviewMode
                ? 'This view shows the fuller organized packet available after expanded review access is approved.'
                : 'This view reflects the limited preview a firm can review before expanded access is approved.'}
            </p>
          </div>

          <section className="mb-4 rounded-[20px] border border-[#CBD6CF] bg-white/95 p-4 shadow-[0_16px_42px_rgba(91,53,213,0.09)]">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#42574E]">Organized Summary</p>
              <div className="mt-2 space-y-2">
                {organizedSummaryParagraphs.length > 0 ? (
                  organizedSummaryParagraphs.map((paragraph, index) => (
                    <p key={`organized-summary-${index}`} className="text-sm leading-relaxed text-[#1B2623]">
                      {paragraph}
                    </p>
                  ))
                ) : (
                  <p className="text-sm leading-relaxed text-[#40433F]">
                    {maturityMessage[intakeMaturityState]}
                  </p>
                )}
                {organizedSummaryParagraphs.length > 0 ? (
                  <p className="rounded-[14px] border border-[#E7EDE8] bg-[#FBFBFA] px-3 py-2 text-sm leading-relaxed text-[#40433F]">
                    {maturityMessage[intakeMaturityState]}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="border-t border-[#E7EDE8] pt-4">
              <h2 className="text-sm font-semibold text-[#131A17]">What one3seven Organized</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {confidenceItems.map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-[14px] border px-3 py-3 ${
                      item.complete
                        ? 'border-[#CBD6CF] bg-[#F8F4FF]'
                        : 'border-[#E4E5DE] bg-[#FAF9F6]'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle2
                        className={`mt-0.5 h-4 w-4 shrink-0 ${item.complete ? 'text-[#42574E]' : 'text-[#9AA39B]'}`}
                        aria-hidden
                      />
                      <div>
                        <p className="text-sm font-semibold text-[#131A17]">{item.label}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[#40433F]">{item.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {(showEmploymentHandoff || showInjuryHandoff) ? (
              <div className="border-t border-[#E7EDE8] pt-4">
                <h2 className="text-sm font-semibold text-[#131A17]">{WORKER_RECORD_HANDOFF.heading}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#40433F]">{WORKER_RECORD_HANDOFF.intro}</p>
                <ul className="mt-2 space-y-1 text-sm leading-relaxed text-[#40433F]">
                  {showEmploymentHandoff ? <li>{WORKER_RECORD_HANDOFF.employmentLine}</li> : null}
                  {showInjuryHandoff ? <li>{WORKER_RECORD_HANDOFF.injuryLine}</li> : null}
                </ul>
                {showBothHandoffNote ? (
                  <p className="mt-2 text-sm leading-relaxed text-[#40433F]">{WORKER_RECORD_HANDOFF.bothNote}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 border-t border-[#E7EDE8] pt-4 lg:grid-cols-2">
              <div className="rounded-[14px] border border-[#E7EDE8] bg-[#FBFBFA] px-3 py-3">
                <h2 className="text-sm font-semibold text-[#131A17]">Additional Information May Help</h2>
                {missingInformationItems.length > 0 ? (
                  <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-[#40433F]">
                    {missingInformationItems.map((item, index) => (
                      <li key={`missing-confidence-${index}`} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5E7268]" />
                        <span className="break-words overflow-hidden min-w-0">{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-[#40433F]">
                    No obvious missing information is listed yet.
                  </p>
                )}
              </div>

              <div className="rounded-[14px] border border-[#CBD6CF] bg-white px-3 py-3">
                <h2 className="text-sm font-semibold text-[#131A17]">Next Recommended Action</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#40433F]">{nextRecommendedAction}</p>
              </div>
            </div>
          </section>

          {employmentMatterTags.length > 0 ? (
            <section className="mb-4 rounded-[14px] border border-[#F2F4EC] bg-white px-4 py-3.5 shadow-sm">
              {concernsAcknowledged === null ? (
                <>
                  <h2 className="text-sm font-semibold text-[#1B2623] mb-1">Based on what you described, we identified potential concerns related to:</h2>
                  <div className="mb-3">
                    <EmploymentMatterChipList tags={employmentMatterTags} />
                  </div>
                  <p className="text-xs text-[#7C857F] mb-3">Does this sound right?</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setConcernsAcknowledged(true)}
                      className="rounded-full border border-[#42574E] px-3 py-1 text-xs font-medium text-[#42574E] hover:bg-[#F7F9F5]"
                    >
                      Yes, that's right
                    </button>
                    <button
                      type="button"
                      onClick={() => setConcernsAcknowledged(false)}
                      className="rounded-full border border-[#E4E5DE] px-3 py-1 text-xs font-medium text-[#6A6D66] hover:bg-[#F2F4EC]"
                    >
                      Not exactly
                    </button>
                  </div>
                </>
              ) : concernsAcknowledged ? (
                <>
                  <h2 className="text-sm font-semibold text-[#1B2623] mb-2">Identified concerns</h2>
                  <EmploymentMatterChipList tags={employmentMatterTags} />
                </>
              ) : (
                <>
                  <h2 className="text-sm font-semibold text-[#1B2623] mb-1">Potential concerns (to review)</h2>
                  <EmploymentMatterChipList tags={employmentMatterTags} />
                  <p className="mt-2 text-xs text-[#7C857F] leading-relaxed">You can add more detail to your story or upload additional records — one3seven will update your organized file.</p>
                </>
              )}
            </section>
          ) : null}

          {pendingAccessRequests ? (
            <section
              id="firm-access-approval-top"
              tabIndex={-1}
              className="mb-4 space-y-3 outline-none"
              aria-label="Firm access requests"
            >
              {pendingAccessRequests.map((req) => {
                const busy = accessApprovalBusyRouteId === req.routeId;
                const barSearchUrl = req.barState ? STATE_BAR_SEARCH_URLS[req.barState] : null;
                const barStateLabel = req.barState ? (STATE_LABELS[req.barState] ?? req.barState) : null;
                return (
                  <div
                    key={req.routeId}
                    className="rounded-[14px] border border-amber-200 bg-amber-50/90 p-4 shadow-sm"
                  >
                    <h2 className="text-base font-semibold text-[#1B2623]">Firm access request</h2>
                    <p className="mt-1 text-sm font-medium text-[#1B2623]">{req.firmName || 'Participating firm'}</p>
                    <p className="mt-1 text-xs font-medium text-amber-950">
                      Full access requested — awaiting your approval
                    </p>
                    {req.barNumber || req.barState ? (
                      <div className="mt-2 rounded-[10px] border border-amber-100 bg-white/70 px-3 py-2">
                        <p className="text-xs font-medium text-[#384039] mb-1">Attorney-provided credentials</p>
                        {req.barState ? (
                          <p className="text-xs text-[#6A6D66]">
                            State: <span className="font-medium text-[#1B2623]">{barStateLabel}</span>
                          </p>
                        ) : null}
                        {req.barNumber ? (
                          <p className="text-xs text-[#6A6D66] mt-0.5">
                            Bar number: <span className="font-mono font-medium text-[#1B2623]">{req.barNumber}</span>
                          </p>
                        ) : null}
                        {barSearchUrl ? (
                          <a
                            href={barSearchUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-[#374A42] underline underline-offset-2 hover:text-[#1B2623]"
                          >
                            Search {barStateLabel} State Bar directory ↗
                          </a>
                        ) : null}
                        <p className="mt-1.5 text-[10px] text-[#7C857F] leading-relaxed">
                          Credentials are attorney-provided. one3seven does not independently verify bar status.
                        </p>
                      </div>
                    ) : null}
                    <p className="mt-2 text-xs text-[#6A6D66] leading-relaxed">
                      {PARTICIPATING_NETWORK_COPY.firmsDoNotSee} Approve only when you are ready for this firm to
                      open your full organized packet and connected records.
                    </p>
                    {accessApprovalError && accessApprovalErrorRouteId === req.routeId && !busy ? (
                      <p
                        className="mt-3 text-sm text-red-800 bg-red-50 border border-red-100 rounded-[12px] px-3 py-2"
                        role="alert"
                      >
                        {accessApprovalError}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={Boolean(accessApprovalBusyRouteId)}
                      onClick={() => void handleApproveAccess(req.routeId)}
                      className="mt-4 w-full min-h-[44px] touch-manipulation text-sm font-medium bg-[#42574E] text-white px-4 py-3 rounded-[12px] hover:bg-[#42574E] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                          Approving…
                        </span>
                      ) : (
                        'Approve full access'
                      )}
                    </button>
                  </div>
                );
              })}
              {accessApprovalMessage ? (
                <p className="text-sm text-[#1B2623] bg-emerald-50 border border-emerald-100 rounded-[14px] px-4 py-3">
                  {accessApprovalMessage}
                </p>
              ) : null}
            </section>
          ) : accessApprovalMessage ? (
            <p className="mb-4 text-sm text-[#1B2623] bg-emerald-50 border border-emerald-100 rounded-[14px] px-4 py-3">
              {accessApprovalMessage}
            </p>
          ) : null}

          <WorkerExpandableSection
            title="Full Story"
            meta="Detailed story and record organization"
            className="mb-3"
            forceOpen={fullReviewMode}
            titleClassName={expandableTitleClass}
          >
            <WorkerRecordStoryBlock
              excerpt={recordStoryExcerpt}
              docCount={uploadedFiles.length}
              eventCount={displayTimelineEvents.length}
            />
          </WorkerExpandableSection>
          {preferLiveDataOnly && workerStoryDisplay ? (
            <div id="worker-story-context-section">
              <WorkerExpandableSection
                title={WORKER_INTAKE_SECTIONS.yourWords}
                meta="What you shared - kept separate from record observations"
                className="mb-3"
                forceOpen={fullReviewMode}
                defaultOpen
                titleClassName={expandableTitleClass}
              >
                {guidedSelectionsDisplay ? (
                  <pre className="text-xs text-[#384039] mb-2 whitespace-pre-wrap font-sans leading-relaxed">
                    {guidedSelectionsDisplay}
                  </pre>
                ) : null}
                <p className="text-sm text-[#384039] leading-relaxed whitespace-pre-wrap">{workerStoryDisplay}</p>
              </WorkerExpandableSection>
            </div>
          ) : null}
          <WorkerExpandableSection
            title={WORKER_INTAKE_SECTIONS.documentTypes}
            meta={
              detectedCategoriesArray.length > 0
                ? uploadedFiles.length + ' records'
                : 'No categories yet'
            }
            className="mb-3"
            forceOpen={fullReviewMode}
            titleClassName={expandableTitleClass}
          >
            {detectedCategoriesArray.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {detectedCategoriesArray.map((category, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.08 + index * 0.03 }}
                    className="rounded-[12px] border border-[#E4E5DE] bg-white p-3 transition-colors hover:border-[#7C8B6F]"
                  >
                    <category.icon className="mb-2 h-4 w-4 text-[#384039]" />
                    <div className="mb-1 text-sm font-medium text-[#1B2623]">{category.name}</div>
                    <div className="text-xs text-[#384039]">
                      {category.count} {category.count === 1 ? 'record' : 'records'}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="rounded-[12px] border border-[#E4E5DE] bg-[#FAF9F6] p-4 text-center">
                <p className="text-sm text-[#384039]">No uploaded records are available for this intake yet.</p>
              </div>
            )}
          </WorkerExpandableSection>
          {preferLiveDataOnly ? (
            <WorkerExpandableSection
              title={WORKER_INTAKE_SECTIONS.firmActivity}
              meta={
                connectedFirmName
                  ? `Connected · ${connectedFirmName}`
                  : 'No firm connected — tap to add'
              }
              forceOpen={fullReviewMode}
              className="mb-0"
              titleClassName={expandableTitleClass}
            >
              {isParticipatingSubmissionChannel(submissionChannel) ||
              participatingRoutingActive ? (
                <ParticipatingNetworkStatusSection
                  className="bg-white border-0 px-0 py-0"
                  workflowStatus={workerWorkflowStatus}
                  submissionChannel={submissionChannel ?? 'participating'}
                  previewSent={participatingRoutingActive}
                  accessRequestCount={liveAccessRequests?.length ?? 0}
                />
              ) : (
                <WorkerFirmCodeSection
                  className="bg-white border-0 px-0 py-0"
                  firmName={connectedFirmName}
                  firmCode={connectedFirmCode}
                  routeStatus={connectedRouteStatus}
                  routeSharedAt={connectedRouteSharedAt}
                  submissionChannel={submissionChannel}
                  busy={firmCodeActionBusy}
                  error={firmCodeActionError}
                  onAddFirmCode={
                    onAddFirmCode ??
                    (onShareFirmCode
                      ? () => {
                          setShareApiError('');
                          setFirmCodeInput('');
                          setRoutingSubpanel('firm_code');
                          setShowShareModal(true);
                        }
                      : undefined)
                  }
                  onRemoveFirmCode={onRemoveFirmCode}
                />
              )}
            </WorkerExpandableSection>
          ) : null}
        </motion.div>

        {preferLiveDataOnly && onSaveWorkerIntakeNotes ? (
          <section id="worker-intake-notes-section" className="px-6 pb-6">
            <div className="rounded-[12px] border border-[#E4E5DE] bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-[#1B2623] mb-1">Intake notes</h2>
              <p className="text-xs text-[#40433F] mb-2 leading-relaxed">
                Optional notes you add after organization—separate from your guided story.
              </p>
              {!intakeNotesOpen ? (
                <>
                  {savedAdditionalNotesDisplay ? (
                    <p className="text-sm text-[#384039] mb-4 leading-relaxed whitespace-pre-wrap">
                      {savedAdditionalNotesDisplay}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setIntakeNoteDraft(savedAdditionalNotesRaw);
                      setIntakeNotesOpen(true);
                      setIntakeNoteMessage(null);
                    }}
                    className="text-sm font-medium px-4 py-2.5 rounded-[12px] bg-[#42574E] text-white hover:bg-[#42574E]"
                  >
                    {savedAdditionalNotesRaw ? 'Edit Notes' : 'Add Notes'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-[#1B2623] mb-1">Additional intake notes</p>
                  <p className="text-xs text-[#40433F] mb-4 leading-relaxed">
                    Optional context for your firm—separate from your guided story.
                  </p>
                  <textarea
                    value={intakeNoteDraft}
                    onChange={(e) => setIntakeNoteDraft(e.target.value)}
                    placeholder="Share context that helps explain your situation…"
                    rows={5}
                    className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#E4E5DE] rounded-[14px] text-sm text-[#1B2623] placeholder:text-[#9AA39B] mb-3"
                  />
                  {intakeNoteMessage ? (
                    <p
                      className={`text-sm mb-3 ${intakeNoteMessage.includes('Saved') ? 'text-emerald-700' : 'text-red-600'}`}
                    >
                      {intakeNoteMessage}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={intakeNoteSaving || intakeNoteDraft === savedAdditionalNotesRaw}
                      onClick={() => void handleSaveIntakeNotes()}
                      className={`text-sm font-medium px-4 py-2.5 rounded-[12px] ${
                        intakeNoteSaving || intakeNoteDraft === savedAdditionalNotesRaw
                          ? 'bg-[#E4E5DE] text-[#7C857F] cursor-not-allowed'
                          : 'bg-[#42574E] text-white hover:bg-[#42574E]'
                      }`}
                    >
                      {intakeNoteSaving ? 'Saving…' : 'Save notes'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIntakeNotesOpen(false);
                        setIntakeNoteMessage(null);
                        setIntakeNoteDraft(savedAdditionalNotesRaw);
                      }}
                      className="text-sm font-medium px-4 py-2.5 rounded-[12px] border border-[#E4E5DE] text-[#384039] hover:bg-[#F2F4EC]"
                    >
                      Close
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        ) : null}

        {displayTimelineEvents.length > 0 ? (
          <section className="px-4 sm:px-6 pb-4">
            <WorkerExpandableSection
              title={`${WORKER_INTAKE_SECTIONS.timeline} — detail`}
              meta={timelineSectionMeta}
              forceOpen={fullReviewMode}
              variant="quiet"
              titleClassName={expandableTitleClass}
            >
              <ul className="divide-y divide-[var(--o3s-border)]">
                {displayTimelineEvents.map((row, idx) => (
                  <li key={row.timelineEventId ?? `${row.date}-${row.event}-${row.category}`}>
                    <WorkerTimelineEventCard event={row} forceExpanded isKeyEvent={idx === 0} />
                  </li>
                ))}
              </ul>
            </WorkerExpandableSection>
          </section>
        ) : null}

        {(readinessPresentation.supplementalBrief.length > 0 ||
          (liveMissing && liveMissing.length > 0)) ? (
          <section className="px-4 sm:px-6 pb-4">
            <WorkerExpandableSection
              title={WORKER_INTAKE_SECTIONS.reviewItems}
              meta={[
                liveMissing?.length ? `${Math.min(liveMissing.length, 5)} item${Math.min(liveMissing.length, 5) === 1 ? '' : 's'}` : null,
                readinessPresentation.supplementalBrief.length
                  ? `${readinessPresentation.supplementalBrief.length} review note${readinessPresentation.supplementalBrief.length === 1 ? '' : 's'}`
                  : null,
              ]
                .filter(Boolean)
                .join(' / ') || 'Optional review notes'}
              forceOpen={fullReviewMode}
              titleClassName={expandableTitleClass}
            >
              {liveMissing && liveMissing.length > 0 ? (
                <div className="mb-4 rounded-[12px] border border-[#E4E5DE] bg-[#FAF9F6]/80 p-3">
                  <div className="text-sm font-medium text-[#1B2623] mb-1.5">Records that may still help</div>
                  <ul className="list-disc pl-5 text-sm text-[#384039] space-y-1">
                    {liveMissing.slice(0, 5).map((x, i) => (
                      <li key={`m-${i}`}>{softenWorkerReviewLine(x)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {readinessPresentation.supplementalBrief.length > 0 ? (
                <div className="mb-3">
                  <div className="text-sm font-medium text-[#1B2623] mb-1.5">Notes for review</div>
                  <ul className="list-disc pl-5 text-sm text-[#384039] space-y-1">
                    {readinessPresentation.supplementalBrief.map((x, i) => (
                      <li key={`rb-${i}`}>{softenWorkerReviewLine(x)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </WorkerExpandableSection>
          </section>
        ) : null}

        {/* Uploaded files - label, rename, delete */}
        {uploadedFiles.length > 0 ? (
          <section className="px-4 sm:px-6 pb-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
            >
              <WorkerExpandableSection
                title={WORKER_INTAKE_SECTIONS.uploadedFiles}
                meta={`${uploadedFiles.length} file${uploadedFiles.length === 1 ? '' : 's'}`}
                forceOpen={fullReviewMode}
                defaultOpen={fullReviewMode}
                titleClassName={expandableTitleClass}
              >
              <p className="text-xs text-[#40433F] mb-3 leading-relaxed">
                Tap a name for the full label. Rename or remove files here.
              </p>
              <ul className="space-y-2">
                {(showAllUploadedFiles || fullReviewMode
                  ? uploadedFiles
                  : uploadedFiles.slice(0, UPLOADED_FILES_PREVIEW)
                ).map((file, sliceIndex) => {
                  const resolvedIndex = showAllUploadedFiles || fullReviewMode
                    ? sliceIndex
                    : sliceIndex;
                  const key = uploadedFileKey(file);
                  const custom = uploadedFileLabels[key];
                  const display =
                    custom?.trim() ||
                    truncateFileLabel(file.name);
                  const isEditing = editingFileKey === key;
                  return (
                    <li
                      key={key}
                      className="rounded-[14px] border border-[#E4E5DE] bg-white p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        {isEditing && onUploadedFileLabelChange ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="text"
                              maxLength={14}
                              value={editingFileLabel}
                              onChange={(e) => setEditingFileLabel(e.target.value.slice(0, 14))}
                              className="flex-1 min-w-[8rem] px-3 py-2 text-sm border border-[#E4E5DE] rounded-lg bg-[#FAF9F6]"
                              aria-label="File label"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onUploadedFileLabelChange(key, editingFileLabel.trim() || truncateFileLabel(file.name));
                                setEditingFileKey(null);
                              }}
                              className="text-xs font-medium px-3 py-2 rounded-lg bg-[#42574E] text-white"
                            >
                              Save label
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFileKey(null)}
                              className="text-xs font-medium px-3 py-2 rounded-lg border border-[#E4E5DE] text-[#384039]"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <TruncatedNameButton fullName={file.name} display={display} />
                        )}
                        <p className="text-[11px] text-[#7C857F] mt-1">
                          {resolveAttorneyFacingUploadCategory(
                            file.name,
                            uploadedFilePersistMeta[resolvedIndex]?.category
                          )}
                        </p>
                      </div>
                      {!isEditing ? (
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {onUploadedFileLabelChange ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFileKey(key);
                                setEditingFileLabel(display);
                              }}
                              className="text-xs font-medium px-3 py-2 rounded-lg border border-[#E4E5DE] text-[#1B2623] hover:bg-[#F2F4EC]"
                            >
                              Rename
                            </button>
                          ) : null}
                          {onRemoveUploadedFile ? (
                            <button
                              type="button"
                              onClick={() => onRemoveUploadedFile(resolvedIndex)}
                              className="text-xs font-medium px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50"
                            >
                              Delete
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {!fullReviewMode && uploadedFiles.length > UPLOADED_FILES_PREVIEW ? (
                <button
                  type="button"
                  onClick={() => setShowAllUploadedFiles((v) => !v)}
                  className="mt-3 text-sm font-medium text-[#6A6D66] hover:text-[#1B2623]"
                >
                  {showAllUploadedFiles
                    ? WORKER_INTAKE_ACTIONS.showLess
                    : `${WORKER_INTAKE_ACTIONS.showMore} (${uploadedFiles.length - UPLOADED_FILES_PREVIEW})`}
                </button>
              ) : null}
              </WorkerExpandableSection>
            </motion.div>
          </section>
        ) : null}

        {/* Section 5 - Intake Packet Preview */}
        <section className="px-4 sm:px-6 pb-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <WorkerExpandableSection
              title={WORKER_INTAKE_SECTIONS.printablePacket}
              meta="Printable structure for review"
              forceOpen={fullReviewMode}
              titleClassName={expandableTitleClass}
            >
            <div className="space-y-4">
              <IntakePacketPreview model={packetPreviewModel} darkPresentation={sx.packetPreviewDark} />
              <p className={`text-xs text-center leading-relaxed px-2 ${shellMode ? 'text-[var(--o3s-subtle)] sm:text-[#6A6D66]' : 'text-[#6A6D66]'}`}>
                Download a clean packet organized by story, timeline, review areas, and supporting records.
              </p>
            </div>
            </WorkerExpandableSection>
          </motion.div>
        </section>

        {/* Section 6 - Next Step Actions */}
        <section className="px-6 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <h2 className={sx.nextHeading}>Next steps</h2>

            {/* Save Confirmation */}
            <AnimatePresence>
              {showSaveConfirmation && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 bg-[#42574E] text-white rounded-[14px] p-4 flex items-center gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <div className="text-sm">Your intake workspace has been saved.</div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Confirmation */}
            <AnimatePresence>
              {showEmailConfirmation && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 bg-[#42574E] text-white rounded-[14px] p-4 flex items-center gap-3"
                >
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <div className="text-sm">
                    Email delivery is unavailable during the closed beta. Your note was saved with this intake.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Share Confirmation */}
            <AnimatePresence>
              {showShareConfirmation && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-4 bg-[#42574E] text-white rounded-[14px] p-5"
                >
                  <div className="flex items-start gap-3 mb-2">
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div className="text-sm font-medium">{PARTICIPATING_NETWORK_COPY.postSendTitle}</div>
                  </div>
                  <div className="text-xs text-[#E7EDE8] pl-8 leading-relaxed">
                    {PARTICIPATING_NETWORK_COPY.firmsSeeNow} {PARTICIPATING_NETWORK_COPY.firmsDoNotSee} You can
                    track status on your dashboard and approve expanded access if a firm asks.
                  </div>
                  <div className="text-xs text-[#95AB9B] pl-8 mt-2 leading-relaxed">
                    We&apos;ll email you when a firm responds. Most participating firms respond within 1–2 business days.
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleDownloadIntakeSummary}
                className={sx.btnDownload}
              >
                <Download className="w-5 h-5" />
                {WORKER_INTAKE_ACTIONS.downloadPacket}
              </button>
              <button
                onClick={() => onNavigate('upload')}
                className={sx.btnSecondary}
              >
                <Plus className="w-5 h-5" />
                Add More Documents
              </button>
              {preferLiveDataOnly ? (
                <div className="rounded-[14px] border border-[#E4E5DE] bg-[#FAF9F6] px-4 py-3 text-sm text-[#6A6D66]">
                  Email delivery is unavailable during the closed beta.
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowEmailModal(true)}
                  className={`${sx.btnSecondary} transition-colors font-medium flex items-center justify-center gap-2`}
                >
                  <Mail className="w-5 h-5" />
                  Save email note
                </button>
              )}
              <button
                onClick={handleSaveForLater}
                className={sx.btnSecondary}
              >
                <Save className="w-5 h-5" />
                Save for Later
              </button>
              {canSendToLinkedFirm ? (
                <button
                  type="button"
                  disabled={isSharing}
                  onClick={() => void handleSendToLinkedFirm()}
                  className={`${sx.btnPrimaryDark} disabled:opacity-50`}
                >
                  <Share2 className="w-5 h-5" />
                  {isSharing ? 'Sending…' : linkedFirmSendLabel}
                </button>
              ) : participatingPreviewActive ? (
                <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-[14px] px-4 py-3 leading-relaxed">
                  {PARTICIPATING_NETWORK_COPY.postSendTitle}. {PARTICIPATING_NETWORK_COPY.firmsSeeNow}{' '}
                  {PARTICIPATING_NETWORK_COPY.firmsDoNotSee}
                </p>
              ) : !PARTICIPATING_ROUTING_LIVE ? (
                <div
                  className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-[#E4E5DE] bg-[#FAF9F6] px-4 py-3 text-sm font-medium text-[#9AA39B] cursor-not-allowed select-none"
                  title="Sending your organized intake to participating firms is coming soon. For now, download or print your packet to bring to any attorney consultation."
                  aria-disabled="true"
                >
                  <Share2 className="w-5 h-5" />
                  Send to participating firms
                  <span className="ml-1 rounded-full bg-[#E4E5DE] px-2 py-0.5 text-[11px] font-semibold text-[#7C857F]">Coming soon</span>
                </div>
              ) : canShareSummary ? (
                <button
                  onClick={() => {
                    if (hasLinkedFirm && onShareFirmCode) {
                      void handleSendToLinkedFirm();
                      return;
                    }
                    setShareApiError('');
                    setFirmCodeInput('');
                    setRoutingSubpanel('menu');
                    setShowShareModal(true);
                  }}
                  className={sx.btnSecondary}
                >
                  <Share2 className="w-5 h-5" />
                  {hasLinkedFirm ? linkedFirmSendLabel : 'Send Organized Intake'}
                </button>
              ) : null}
              {shareApiError ? (
                <p className="text-sm text-red-600 mt-2">{shareApiError}</p>
              ) : null}
            </div>
          </motion.div>
        </section>

        {showFirmDocRequestSection ? (
          <section id="worker-doc-request-section" className="px-6 pb-10">
            {workflowDocRequestCompleted ? (
              <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-5">
                <h2 className="text-lg font-semibold text-[#1B2623] mb-2">Updated materials sent for firm review</h2>
                <p className="text-sm text-[#384039] mb-4 leading-relaxed">
                  Your firm can refresh their dashboard to review the new files and your response below.
                </p>
                {firmDocRequest && firmDocRequest.categories.length > 0 ? (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-[#6A6D66] mb-1">Originally requested</p>
                    <ul className="list-disc pl-5 text-sm text-[#1B2623] space-y-1">
                      {firmDocRequest.categories.map((c) => (
                        <li key={c}>{polishHumanReadableDisplayText(c) || c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {workerDocResponse && workerDocResponse.fulfilled.length > 0 ? (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-[#6A6D66] mb-1">You indicated these were fulfilled</p>
                    <ul className="list-disc pl-5 text-sm text-[#1B2623] space-y-1">
                      {workerDocResponse.fulfilled.map((c) => (
                        <li key={c}>{polishHumanReadableDisplayText(c) || c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {workerDocResponse?.note ? (
                  <p className="text-sm text-[#384039] mb-4 whitespace-pre-wrap">
                    <span className="font-medium">Your note to the firm:</span>{' '}
                    {polishHumanReadableDisplayText(workerDocResponse.note)}
                  </p>
                ) : null}
                <p className="text-xs text-[#6A6D66] mb-4 leading-relaxed border-t border-emerald-200/80 pt-3">
                  Your firm sees this update when they refresh their intake review. Automatic in-app firm alerts for
                  new uploads are not enabled in this beta yet.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('upload')}
                  className="text-sm text-[#6A6D66] hover:text-[#1B2623] underline underline-offset-2"
                >
                  Add more documents
                </button>
              </div>
            ) : (
              <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-5">
                {showDocRequestConfirmation ? (
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-900 mb-2">Action required</p>
                ) : null}
                <h2 className="text-lg font-semibold text-[#1B2623] mb-2">
                  {firmDocRequest?.firmName
                    ? `${firmDocRequest.firmName} requested additional documents`
                    : 'Additional documents requested'}
                </h2>
                <p className="text-xs text-[#6A6D66] mb-4 leading-relaxed">
                  {showDocRequestConfirmation
                    ? 'Step 1: Upload the records below and run organize. Step 2: Scroll to confirm which categories you are sending back to your firm.'
                    : 'Your firm asked for these records before continuing review.'}
                </p>
                {firmDocRequest && firmDocRequest.categories.length > 0 ? (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-[#6A6D66] mb-1">Requested categories</p>
                    <ul className="list-disc pl-5 text-sm text-[#1B2623] space-y-1">
                      {firmDocRequest.categories.map((c) => (
                        <li key={c}>{polishHumanReadableDisplayText(c) || c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {firmDocRequest?.note ? (
                  <p className="text-sm text-[#384039] mb-4 whitespace-pre-wrap">
                    <span className="font-medium">Firm note:</span> {polishHumanReadableDisplayText(firmDocRequest.note)}
                  </p>
                ) : null}
                {workflowDocRequestPending &&
                firmDocRequest &&
                firmDocRequest.categories.length === 0 &&
                !firmDocRequest.note ? (
                  <p className="text-sm text-[#6A6D66] mb-4">
                    Request details are not loaded yet. Leave and reopen this summary if the list is empty.
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={() => onNavigate('upload')}
                  className="text-sm font-medium bg-[#42574E] text-white px-4 py-2.5 rounded-[12px] hover:bg-[#42574E] mb-4"
                >
                  Upload requested documents
                </button>
                {showDocRequestConfirmation ? (
                  <div id="worker-doc-request-confirm" className="pt-4 border-t border-amber-200/80">
                    <h3 className="text-base font-semibold text-[#1B2623] mb-2">Step 2 — Confirm your response</h3>
                    <p className="text-xs text-[#6A6D66] mb-3 leading-relaxed">
                      Check which requested categories your new uploads satisfy, then send your response. This saves
                      your answer on the intake summary for firm review.
                    </p>
                    <p className="text-xs text-[#6A6D66] mb-3 leading-relaxed bg-white/60 border border-amber-200/60 rounded-lg px-3 py-2">
                      Firm in-app alerts for submitted documents are not enabled in this beta yet. Your firm will see
                      this response when they open or refresh your intake on their dashboard.
                    </p>
                    {workflowResponseMismatch ? (
                      <p className="text-xs text-amber-900 bg-amber-100/80 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                        Your last confirm did not finish saving. Select categories and try again.
                      </p>
                    ) : null}
                    <div className="space-y-2 mb-3">
                      {firmDocRequest!.categories.length === 0 ? (
                        <label
                          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm cursor-pointer border ${
                            fulfilledDraft.includes('Other')
                              ? 'bg-[#42574E] text-white border-[#42574E]'
                              : 'bg-white text-[#1B2623] border-[#E4E5DE]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={fulfilledDraft.includes('Other')}
                            onChange={() => {
                              setDocConfirmError(null);
                              const next = fulfilledDraft.includes('Other') ? [] : ['Other'];
                              setFulfilledDraft(next);
                              persistDocumentResponseDraft(next, noteToFirmDraft);
                            }}
                            disabled={docConfirmBusy}
                          />
                          Other / general documents
                        </label>
                      ) : null}
                      {firmDocRequest!.categories.map((category) => (
                        <label
                          key={category}
                          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm cursor-pointer border ${
                            fulfilledDraft.includes(category)
                              ? 'bg-[#42574E] text-white border-[#42574E]'
                              : 'bg-white text-[#1B2623] border-[#E4E5DE]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={fulfilledDraft.includes(category)}
                            onChange={() => {
                              setDocConfirmError(null);
                              const next = fulfilledDraft.includes(category)
                                ? fulfilledDraft.filter((c) => c !== category)
                                : [...fulfilledDraft, category];
                              setFulfilledDraft(next);
                              persistDocumentResponseDraft(next, noteToFirmDraft);
                            }}
                            disabled={docConfirmBusy}
                          />
                          {polishHumanReadableDisplayText(category) || category}
                        </label>
                      ))}
                    </div>
                    {docDraftSaveMessage ? (
                      <p className="text-xs font-medium text-emerald-700 mb-2">{docDraftSaveMessage}</p>
                    ) : null}
                    {docDraftSaveError ? (
                      <p className="text-xs text-amber-800 bg-amber-100/80 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                        {docDraftSaveError}
                      </p>
                    ) : null}
                    {docDraftSaving ? <p className="text-xs text-[#7C857F] mb-2">Saving…</p> : null}
                    <label className="text-xs font-medium text-[#384039] mb-1 block">Optional note to firm</label>
                    <textarea
                      value={noteToFirmDraft}
                      onChange={(e) => {
                        const nextNote = e.target.value;
                        setNoteToFirmDraft(nextNote);
                        if (docConfirmError) setDocConfirmError(null);
                        persistDocumentResponseNoteDraft(fulfilledDraft, nextNote);
                      }}
                      className="w-full mb-3 px-3 py-2 border border-[#E4E5DE] rounded-lg text-sm h-20 resize-none"
                      placeholder="Brief context for your firm (optional)."
                      disabled={docConfirmBusy}
                    />
                    {docConfirmError ? (
                      <p className="text-xs text-amber-800 bg-amber-100/80 border border-amber-200 rounded-lg px-3 py-2 mb-3">
                        {docConfirmError}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={docConfirmBusy}
                      onClick={() =>
                        void (async () => {
                          setDocConfirmBusy(true);
                          setDocConfirmError(null);
                          const r = await onConfirmDocumentRequestResponse!({
                            fulfilledCategories: fulfilledDraft,
                            noteToFirm: noteToFirmDraft.trim(),
                          });
                          setDocConfirmBusy(false);
                          if (r.error) {
                            setDocConfirmError(r.error);
                            return;
                          }
                          setFulfilledDraft([]);
                          setNoteToFirmDraft('');
                        })()
                      }
                      className="text-sm font-medium bg-[#42574E] text-white px-4 py-2.5 rounded-[12px] hover:bg-[#42574E] disabled:opacity-50"
                    >
                      {docConfirmBusy ? 'Saving…' : 'Confirm response to firm'}
                    </button>
                  </div>
                ) : workflowDocRequestPending && Boolean(onConfirmDocumentRequestResponse) && !hasFirmDocRequestDetails ? (
                  <div id="worker-doc-request-confirm" className="pt-4 border-t border-amber-200/80">
                    <p className="text-xs text-[#6A6D66] leading-relaxed">
                      After you upload and organize, return here to confirm your response. If requested categories do
                      not appear, refresh this summary or open upload from your notification again.
                    </p>
                  </div>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {PARTICIPATING_ROUTING_LIVE && BETA_ENABLE_PARTICIPATING_ROUTING ? (
          <section className={sx.betaSection}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9, duration: 0.5 }}
              className="bg-white rounded-[16px] p-6 border border-[#E4E5DE]"
            >
              <p className="text-sm text-[#384039] leading-relaxed mb-4">
                {PARTICIPATING_NETWORK_COPY.shareModalBody} Participating firms may review a preview, request
                expanded access, ask for additional records, or take no further action - your intake stays active in
                the network either way.
              </p>
              <p className="text-sm text-[#384039] leading-relaxed mb-4">
                A firm&apos;s next step does not change what one3seven organizes for you. {ONE3SEVEN_NOTICES.positioning}
              </p>
              <p className="text-sm text-[#6A6D66] leading-relaxed">
                You may continue uploading documents, updating timelines, saving summaries, or sharing organized records elsewhere.
              </p>
            </motion.div>
          </section>
        ) : null}

        {/* Footer Disclaimer */}
        <footer className={sx.footer}>
          <div className="bg-[#FAF9F6] rounded-[16px] p-6 border border-[#E4E5DE]">
            <h3 className="text-sm font-semibold text-[#1B2623] mb-4">About one3seven</h3>
            <p className="text-xs text-[#6A6D66] leading-relaxed mb-3">{ONE3SEVEN_NOTICES.positioning}</p>
            <p className="text-xs text-[#6A6D66] leading-relaxed">
              Intake summaries, timeline snapshots, category tags, and readiness notes are organizational aids for review preparation only.
            </p>
          </div>
        </footer>
      </div>

      {/* Email Modal */}
      <AnimatePresence>
        {showEmailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1B2623]/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
            onClick={() => !isSending && setShowEmailModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-white rounded-t-[24px] sm:rounded-[24px] w-full max-w-md mx-4 mb-0 sm:mb-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-[#1B2623]">Save Email Note</h3>
                  <button
                    onClick={() => !isSending && setShowEmailModal(false)}
                    className="text-[#9AA39B] hover:text-[#6A6D66] transition-colors"
                    disabled={isSending}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Email Address */}
                <div className="mb-5">
                  <label className="text-sm font-medium text-[#1B2623] mb-2 block">Email Address</label>
                  <input
                    type="email"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#E4E5DE] rounded-[14px] text-sm text-[#1B2623] placeholder:text-[#9AA39B] focus:outline-none focus:ring-2 focus:ring-[#42574E] focus:border-transparent"
                    disabled={isSending}
                  />
                </div>

                {/* Optional Note */}
                <div className="mb-6">
                  <label className="text-sm font-medium text-[#1B2623] mb-2 block">Optional Note</label>
                  <textarea
                    value={emailNote}
                    onChange={(e) => setEmailNote(e.target.value)}
                    placeholder="Add a note to yourself (optional)"
                    className="w-full h-24 px-4 py-3 bg-[#FAF9F6] border border-[#E4E5DE] rounded-[14px] text-sm text-[#1B2623] placeholder:text-[#9AA39B] focus:outline-none focus:ring-2 focus:ring-[#42574E] focus:border-transparent resize-none"
                    disabled={isSending}
                  />
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    onClick={handleEmailSubmit}
                    disabled={!emailAddress.trim() || isSending}
                    className={`w-full py-4 px-6 rounded-[14px] transition-all font-medium flex items-center justify-center gap-2 ${
                      !emailAddress.trim() || isSending
                        ? 'bg-[#E4E5DE] text-[#9AA39B] cursor-not-allowed'
                        : 'bg-[#42574E] text-white hover:bg-[#42574E] shadow-sm hover:shadow-md'
                    }`}
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Mail className="w-5 h-5" />
                        Save note with intake
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setShowEmailModal(false)}
                    disabled={isSending}
                    className={`w-full py-4 px-6 rounded-[14px] transition-colors font-medium ${
                      isSending
                        ? 'bg-[#F2F4EC] text-[#9AA39B] cursor-not-allowed'
                        : 'bg-[#F2F4EC] text-[#1B2623] hover:bg-[#E4E5DE]'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send organized intake (routing) */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1B2623]/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
            onClick={() => !isSharing && setShowShareModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="bg-white rounded-t-[24px] sm:rounded-[24px] w-full max-w-md mx-4 mb-0 sm:mb-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-[#1B2623]">Send organized intake</h3>
                  <button
                    type="button"
                    onClick={() => !isSharing && setShowShareModal(false)}
                    className="text-[#9AA39B] hover:text-[#6A6D66] transition-colors"
                    disabled={isSharing}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {routingSubpanel === 'menu' ? (
                  <>
                    {hasLinkedFirm ? (
                      <>
                        <p className="text-sm text-[#384039] leading-relaxed mb-4">
                          {FIRM_ROUTING_COPY.sendOrganizedIntro}
                        </p>
                        <p className="text-xs text-[#40433F] leading-relaxed mb-6">
                          {FIRM_ROUTING_COPY.firmCodeFieldHelp}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-[#384039] leading-relaxed mb-3">
                          Choose how to share your organized intake. You do not need a firm code to use the
                          participating review network.
                        </p>
                        <p className="text-xs text-[#6A6D66] leading-relaxed mb-3">
                          {PARTICIPATING_NETWORK_COPY.shareModalBody}
                        </p>
                        <p className="text-xs text-[#40433F] leading-relaxed mb-6">
                          {PARTICIPATING_NETWORK_COPY.firmsSeeNow} {PARTICIPATING_NETWORK_COPY.firmsDoNotSee}
                        </p>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="text-xs text-[#6A6D66] mb-4 hover:text-[#1B2623]"
                      disabled={isSharing}
                      onClick={() => {
                        setShareApiError('');
                        setRoutingSubpanel('menu');
                      }}
                    >
                      ← Back
                    </button>
                    <p className="text-sm text-[#6A6D66] mb-3">{FIRM_ROUTING_COPY.firmCodeFieldHelp}</p>
                    <input
                      value={firmCodeInput}
                      onChange={(e) => setFirmCodeInput(e.target.value)}
                      placeholder="e.g. ABC12XYZ"
                      className="w-full px-4 py-3 bg-[#FAF9F6] border border-[#E4E5DE] rounded-[14px] text-sm mb-3"
                      disabled={isSharing}
                    />
                  </>
                )}

                {shareApiError ? (
                  <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-[14px] px-4 py-3">{shareApiError}</div>
                ) : null}

                <div className="space-y-3">
                  {routingSubpanel === 'menu' ? (
                    <>
                      {canRouteParticipating && !hasLinkedFirm ? (
                        <button
                          type="button"
                          onClick={() => void handleParticipatingShare()}
                          disabled={isSharing}
                          className={`w-full py-4 px-6 rounded-[14px] transition-all font-medium flex items-center justify-center gap-2 ${
                            isSharing
                              ? 'bg-[#9AA39B] text-white cursor-not-allowed'
                              : 'bg-[#42574E] text-white hover:bg-[#42574E] shadow-sm hover:shadow-md'
                          }`}
                        >
                          {isSharing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Sending…
                            </>
                          ) : (
                            <>
                              <Share2 className="w-5 h-5" />
                              {PARTICIPATING_NETWORK_COPY.shareModalTitle}
                            </>
                          )}
                        </button>
                      ) : null}
                      {canRouteFirmCode && !hasLinkedFirm ? (
                        <button
                          type="button"
                          onClick={() => {
                            setShareApiError('');
                            setRoutingSubpanel('firm_code');
                          }}
                          disabled={isSharing}
                          className={`w-full py-4 px-6 rounded-[14px] border text-[#1B2623] font-medium transition-colors flex items-center justify-center gap-2 ${
                            isSharing
                              ? 'border-[#E4E5DE] text-[#9AA39B] cursor-not-allowed'
                              : 'border-[#CBD6CF] hover:bg-[#F2F4EC]'
                          }`}
                        >
                          Enter Firm Code
                        </button>
                      ) : null}
                      {hasLinkedFirm && onShareFirmCode ? (
                        <button
                          type="button"
                          onClick={() => void handleSendToLinkedFirm()}
                          disabled={isSharing}
                          className={`w-full py-4 px-6 rounded-[14px] transition-all font-medium flex items-center justify-center gap-2 ${
                            isSharing
                              ? 'bg-[#9AA39B] text-white cursor-not-allowed'
                              : 'bg-[#42574E] text-white hover:bg-[#42574E] shadow-sm hover:shadow-md'
                          }`}
                        >
                          {isSharing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Sending…
                            </>
                          ) : (
                            <>
                              <Share2 className="w-5 h-5" />
                              {linkedFirmShareModalButtonLabel(connectedFirmName, linkedFirmAlreadyShared)}
                            </>
                          )}
                        </button>
                      ) : !canRouteParticipating && !onShareFirmCode ? (
                        <button
                          type="button"
                          onClick={() => void handleShareSubmit()}
                          disabled={isSharing}
                          className={`w-full py-4 px-6 rounded-[14px] transition-all font-medium flex items-center justify-center gap-2 ${
                            isSharing
                              ? 'bg-[#9AA39B] text-white cursor-not-allowed'
                              : 'bg-[#42574E] text-white hover:bg-[#42574E] shadow-sm hover:shadow-md'
                          }`}
                        >
                          {isSharing ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Sending…
                            </>
                          ) : (
                            <>
                              <Share2 className="w-5 h-5" />
                              Send organized intake
                            </>
                          )}
                        </button>
                      ) : null}
                    </>
                  ) : (
                    <>
                      {onShareFirmCode ? (
                        <button
                          type="button"
                          disabled={isSharing || !firmCodeInput.trim()}
                          onClick={() => void handleFirmCodeShare()}
                          className="w-full bg-[#42574E] text-white py-4 rounded-[14px] font-medium disabled:opacity-50"
                        >
                          {isSharing ? 'Routing…' : 'Route with Firm Code'}
                        </button>
                      ) : null}
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    disabled={isSharing}
                    className={`w-full py-4 px-6 rounded-[14px] transition-colors font-medium ${
                      isSharing
                        ? 'bg-[#F2F4EC] text-[#9AA39B] cursor-not-allowed'
                        : 'bg-[#F2F4EC] text-[#1B2623] hover:bg-[#E4E5DE]'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {fullReviewMode ? (
        <WorkerFullReviewBar
          onExit={() => {
            setFullReviewMode(false);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          onDownload={() => void handleDownloadIntakeSummary()}
        />
      ) : null}

    </div>
  );
}
