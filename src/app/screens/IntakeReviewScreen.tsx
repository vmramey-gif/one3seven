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
  ClipboardCheck,
  Search,
  HelpCircle,
  User,
  HeartHandshake,
  AlignLeft,
  FileJson,
  CalendarPlus,
} from 'lucide-react';
import { Screen } from '../App';
import {
  IntakeWorkspace,
  WorkflowStatus,
  updateWorkflowStatus,
} from '../types/IntakeWorkspace';
import { pickReviewBase } from '../utils/reviewDataSelection';

import type { FirmLiveIntakeView } from '../../services/intakeDataService';
import {
  downloadFirmIntakeReviewDocument,
  resolveWageExposure,
  resolveFirmExportAccessTier,
  firmViewToExportPayload,
  buildPriorityQuestionsForView,
} from '../../services/firmIntakeSummaryDownload';
import {
  buildExecutiveSummary,
  buildCaseSnapshot,
  buildPacketChronologyPresentation,
  buildWorkerAccount,
  buildReviewTopicBullets,
  buildMissingRecordBullets,
} from '../../services/packetStoryPresentation';
import { triggerIntakeFactExtraction } from '../../services/documentFactsService';
import type { SourceCitation } from '../../services/damagesCalculator';
import { normalizeFilenameForMatching } from '../../services/filenameMatching';
import { CitationPanel } from '../components/CitationPanel';
import { ClaimLensPanel } from '../components/ClaimLensPanel';
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
import { WordMark } from '../components/WordMark';

interface IntakeReviewScreenProps {
  onNavigate: (screen: Screen) => void;
  intakeId: string;
  intakeWorkspace?: IntakeWorkspace;
  onUpdateWorkspace?: (updates: Partial<IntakeWorkspace>) => void;
  firmLiveView?: FirmLiveIntakeView | null;
  firmLiveViewLoading?: boolean;
  /** Set when a connected-firm load was attempted but failed (as opposed to a legitimately empty
   * or not-yet-connected view) — surfaces a real error state instead of silently showing nothing. */
  firmLiveViewError?: string | null;
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
  onAddWorkerReminder?: (payload: { text: string; dueDate: string | null }) => Promise<{ error?: string }>;
  onReloadFirmLiveView?: () => void | Promise<void>;
  /** Strips nav chrome down to a single slim bar — used for the public demo link. */
  demoMode?: boolean;
  /** Name shown in the demo orientation strip. Defaults to the original single-case demo's worker. */
  demoWorkerName?: string;
  /**
   * Demo-only citation source lookup: given a source file name, returns a static public URL
   * to a real PDF (or null if none exists), instead of signing a Supabase Storage URL. When
   * provided, `openQuoteCitation` checks it FIRST and never touches Supabase. Undefined in
   * every real (non-demo) call site, so production citation behavior is unchanged.
   */
  demoSourceUrlResolver?: (fileName: string) => string | null;
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

const FIRM_REVIEW_PAGE = 'min-h-screen o3s-firm-cockpit o3s-firm-review-skin';
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
  firmLiveViewError = null,
  onRequestFullAccess,
  onOpenFirmSettings,
  onFirmSignOut,
  firmDisplayName,
  firmBellNotifications = [],
  onAcceptIntake,
  onDeclineIntake,
  onRequestAdditionalDocuments,
  onAddWorkerReminder,
  onReloadFirmLiveView,
  demoMode = false,
  demoWorkerName = 'Marcus Rivera',
  demoSourceUrlResolver,
}: IntakeReviewScreenProps) {
  // Use workspace data if available, otherwise fall back to mock
  const rawWorkflow = (intakeWorkspace?.workflowStatus as string | undefined) ?? 'new';
  const currentWorkflowStatus: WorkflowStatus =
    rawWorkflow === 'declined' ? 'not-pursuing' : (rawWorkflow as WorkflowStatus);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(currentWorkflowStatus);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showFirmDocRequestModal, setShowFirmDocRequestModal] = useState(false);
  const [docReqCategories, setDocReqCategories] = useState<string[]>([]);
  const [docReqNote, setDocReqNote] = useState('');
  const [docReqSubmitting, setDocReqSubmitting] = useState(false);
  const [docReqError, setDocReqError] = useState<string | null>(null);
  const [showAddReminderModal, setShowAddReminderModal] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderDueDate, setReminderDueDate] = useState('');
  const [addReminderSubmitting, setAddReminderSubmitting] = useState(false);
  const [addReminderError, setAddReminderError] = useState<string | null>(null);
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
  // Dedicated URL for the currently-open QUOTE citation. Kept separate from citationUrls (which the
  // wage-exposure effect owns and resets on firmLiveView changes) so an on-demand quote URL can't be
  // clobbered out from under an open panel.
  const [quoteCitationUrl, setQuoteCitationUrl] = useState<string | null>(null);

  // Binder-spine tab state — presentation wrapper only. Gates which top-level
  // sections render; does not change any data, logic, or doctrine gating.
  type BinderTab = 'simple' | 'decision' | 'timeline' | 'claimlens' | 'documents' | 'gaps' | 'context';
  const [activeTab, setActiveTab] = useState<BinderTab>('decision');
  // Call-prep checklist check-state — session-local by design (a live-call aid, not a persisted
  // record; nothing here is worker-facing or written back to the intake).
  const [checkedPrepQuestions, setCheckedPrepQuestions] = useState<Set<number>>(new Set());
  const TABS: { id: BinderTab; label: string; Icon: typeof FileText; accent?: boolean }[] = [
    { id: 'simple', label: 'Simple read', Icon: AlignLeft },
    { id: 'decision', label: 'Decision card', Icon: ClipboardCheck },
    { id: 'timeline', label: 'Timeline', Icon: Clock },
    { id: 'claimlens', label: 'Element lens', Icon: Search },
    { id: 'documents', label: 'Documents', Icon: FileText },
    { id: 'gaps', label: 'Gaps & requests', Icon: HelpCircle },
    { id: 'context', label: 'Worker context', Icon: User, accent: true },
  ];

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

  // Clickable extraction quotes: map a quote's file name -> { docId, storage path } so any key quote
  // can open to its exact spot. The CitationPanel is snippet-anchored (it searches the PDF text for
  // the verbatim quote), so a quote needs no extraction provenance — just its source file. Full-access
  // only; previewOnly can't sign URLs (storage RLS enforces it too).
  const quoteSourceByFileName = useMemo(() => {
    const m = new Map<string, { docId: string; path: string }>();
    if (!firmLiveView || firmLiveView.previewOnly) return m;
    for (const f of firmLiveView.files) {
      if (f.uploaded_file_id && f.file_path) {
        m.set(normalizeFilenameForMatching(f.file_name), { docId: f.uploaded_file_id, path: f.file_path });
      }
    }
    return m;
  }, [firmLiveView]);

  const openQuoteCitation = async (fileName: string, quote: string) => {
    if (!quote.trim()) return;
    // Demo mode: resolve against the static PDF lookup instead of Supabase Storage. Checked
    // FIRST and returns — the real signed-URL path below never runs when a resolver is passed.
    const demoUrl = demoSourceUrlResolver ? demoSourceUrlResolver(fileName) : null;
    if (demoUrl) {
      setQuoteCitationUrl(demoUrl);
      setOpenCitation({
        docId: `demo:${fileName}`,
        docName: fileName,
        page: 1,
        charStart: 0,
        charEnd: quote.length,
        sourceText: quote,
      });
      return;
    }
    const hit = quoteSourceByFileName.get(normalizeFilenameForMatching(fileName));
    if (!hit) return;
    // Open the panel IMMEDIATELY so the click is never dead — it shows the quote right away, then the
    // PDF loads once the signed URL resolves (or a graceful "highlight unavailable" fallback if it
    // can't). Signing is wrapped so a failure/throw can't prevent the panel from opening.
    setQuoteCitationUrl(citationUrls[hit.docId] ?? null);
    setOpenCitation({
      docId: hit.docId,
      docName: fileName,
      page: 1,
      charStart: 0,
      charEnd: quote.length,
      sourceText: quote,
    });
    if (citationUrls[hit.docId]) return;
    try {
      const res = await createFirmIntakeFileSignedUrl(hit.path, 3600);
      if (res.url) {
        setQuoteCitationUrl(res.url);
        setCitationUrls((prev) => ({ ...prev, [hit.docId]: res.url as string }));
      } else {
        console.warn('[citation] could not sign firm source', { error: res.error, path: hit.path });
      }
    } catch (e) {
      console.warn('[citation] error signing firm source', e);
    }
  };

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
    const timelineLivePresent = Boolean(firmLiveView?.events?.length);
    const base: TimelineEvent[] = pickReviewBase<TimelineEvent>({
      connected: preferConnectedLiveIntake,
      loading: Boolean(firmLiveViewLoading),
      livePresent: timelineLivePresent,
      live: timelineLivePresent && firmLiveView ? mapEventsToTimeline(firmLiveView) : [],
      ws: mapWorkspaceTimelineForReview(intakeWorkspace),
    });
    // Chronological order is load-bearing: "The sequence", the chronology, and the key-date
    // anchors all read top-to-bottom. An unsorted feed put a May-2026 record above a March-2021
    // start and mis-anchored the timing display. Sort ascending; undated events sink to the end
    // (stable), never jumping ahead of dated ones.
    return [...base]
      .map((e, i) => ({ e, i, ms: new Date(e.date).getTime() }))
      .sort((a, b) => {
        const aBad = Number.isNaN(a.ms);
        const bBad = Number.isNaN(b.ms);
        if (aBad && bBad) return a.i - b.i;
        if (aBad) return 1;
        if (bBad) return -1;
        return a.ms - b.ms || a.i - b.i;
      })
      .map((x) => x.e);
  })();

  const documentCategoriesForDisplay = pickReviewBase<DocumentCategory>({
    connected: preferConnectedLiveIntake,
    loading: Boolean(firmLiveViewLoading),
    livePresent: Boolean(firmLiveView),
    live: firmLiveView ? buildDocCategoriesFromFiles(firmLiveView.files, firmLiveView.previewOnly) : [],
    ws: buildDocCategoriesFromWorkspaceDocuments(intakeWorkspace),
  });

  const liveTimelineEmptyMessage =
    'No timeline events are available for this intake yet. Records may still be organizing, or your preview access may be limited until full access is approved.';
  const liveDocumentsEmptyMessage =
    'No documents are listed for this intake yet. Files appear here after uploads are organized and you have the appropriate review access.';

  const useConnectedFirmLayout = Boolean(firmLiveView);

  const firmOverviewFields =
    firmLiveView && useConnectedFirmLayout ? buildFirmIntakeOverviewFields(firmLiveView) : [];

  // Defense-in-depth preview gate: the loader already withholds the worker narrative on
  // preview-only routes (see loadFirmLiveIntakeView), but every narrative render site on this
  // screen re-checks previewOnly so no future loader regression can leak the story pre-approval.
  const firmWorkerStoryDisplay =
    firmLiveView && useConnectedFirmLayout && !firmLiveView.previewOnly
      ? buildFirmWorkerStoryDisplay(firmLiveView)
      : '';

  // Worker identity — lifted to component scope so the case-file spine and the intake header
  // can lead with a real human name (never a bare number). A named worker who assembled and
  // shared their own record is the visible proof of the worker-first ecosystem the attorney benefits from.
  const workerIdentity = (() => {
    // Preview gate (defense-in-depth): never mine the worker narrative pre-approval.
    const ctx = firmLiveView?.previewOnly
      ? ''
      : firmLiveView?.workerProvidedContext ?? firmWorkerStoryDisplay ?? '';
    const extract = (source: string, patterns: RegExp[]): string => {
      for (const p of patterns) {
        const m = source.match(p);
        if (m?.[1]?.trim()) return m[1].trim();
      }
      return '';
    };
    // 1) Structured intake fields (real intakes carry a labeled "Full name…" line).
    let name = polishNameForDisplay(extract(ctx, [
      /full name used during employment[:\s]+([^\n]+)/i,
      /worker name[:\s]+([^\n]+)/i,
      /name[:\s]+([^\n]+)/i,
    ]));
    // 2) Prose fallback — pull the name from the overview narrative ("…records, NAME was employed…").
    if (!name) {
      const prose = `${firmLiveView?.overview ?? ''}\n${ctx}`;
      const m = prose.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z'’.-]+){1,2})\s+(?:was|is|were)\s+employed\b/);
      if (m?.[1]) name = polishNameForDisplay(m[1]);
    }
    let employer = polishNameForDisplay(extract(ctx, [
      /employer\s*\/?\s*organization[:\s]+([^\n]+)/i,
      /employer[:\s]+([^\n]+)/i,
      /organization[:\s]+([^\n]+)/i,
    ]));
    // Employer fallback — the structured follow-up answer.
    if (!employer && firmLiveView?.workerFollowUp?.employer) {
      employer = polishNameForDisplay(firmLiveView.workerFollowUp.employer);
    }
    const firstName = name ? name.split(/\s+/)[0] : '';
    return { name, employer, firstName };
  })();

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
    // Elapsed time only — no countdown, no hardcoded window, no computed deadline. We surface that
    // time has passed (a describable fact) and route any deadline determination to the attorney.
    return { elapsed, fromTermination: !!intel.confirmedTerminationDate };
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

  // Open-format sibling of the PDF download — same privacy-tiered payload (firmViewToExportPayload),
  // exported as plain JSON instead of a formatted document.
  const handleDownloadDataJson = () => {
    if (!firmLiveView) {
      showToastMessage('Load an intake before downloading data.');
      return;
    }
    try {
      const tier = resolveFirmExportAccessTier(firmLiveView);
      const payload = firmViewToExportPayload(firmLiveView, tier);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `one3seven-intake-${(payload.intakeNumber || 'export').replace(/[^\w-]/g, '_')}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      showToastMessage('Intake data downloaded (JSON).');
    } catch {
      showToastMessage('Could not export the data. Try again.');
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
      onUpdateWorkspace?.(updated);
    }

    showToastMessage('Demo workspace status updated (not saved to live intakes).');
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

  const openAddReminderModal = () => {
    setReminderText('');
    setReminderDueDate('');
    setAddReminderError(null);
    setShowAddReminderModal(true);
  };

  const closeAddReminderModal = () => {
    if (addReminderSubmitting) return;
    setShowAddReminderModal(false);
    setReminderText('');
    setReminderDueDate('');
    setAddReminderError(null);
  };

  const handleSubmitAddReminder = async () => {
    if (!onAddWorkerReminder) return;
    if (!reminderText.trim()) {
      setAddReminderError('Enter what this reminder is for.');
      return;
    }
    setAddReminderError(null);
    setAddReminderSubmitting(true);
    try {
      const result = await onAddWorkerReminder({
        text: reminderText.trim(),
        dueDate: reminderDueDate.trim() || null,
      });
      if (result?.error) {
        setAddReminderError(result.error);
        return;
      }
      closeAddReminderModal();
      showToastMessage('Reminder added for the worker.');
    } finally {
      setAddReminderSubmitting(false);
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
                <span className="hidden lg:inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                  ⚠ Time-sensitive dates
                </span>
              )}
              <button
                onClick={handleDownloadSummary}
                className="hidden lg:flex items-center gap-1.5 rounded-full bg-[#42574E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#42574E] transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                type="button"
                onClick={handleDownloadDataJson}
                title="Download the underlying data as JSON"
                className="hidden lg:flex items-center justify-center rounded-full border border-[#D8E0CF] p-1.5 text-[#42574E] transition-colors hover:bg-[#F2F4EC]"
              >
                <FileJson className="w-3.5 h-3.5" />
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
                  <span className="hidden lg:inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                    ⚠ Time-sensitive dates
                  </span>
                )}
                <button
                  onClick={handleDownloadSummary}
                  className="hidden lg:flex items-center gap-1.5 rounded-full bg-[#42574E] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#42574E] transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={handleDownloadDataJson}
                  title="Download the underlying data as JSON"
                  className="hidden lg:flex items-center justify-center rounded-full border border-[#D8E0CF] p-1.5 text-[#42574E] transition-colors hover:bg-[#F2F4EC]"
                >
                  <FileJson className="w-3.5 h-3.5" />
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

      {!firmLiveView && !firmLiveViewLoading && firmLiveViewError && !demoMode ? (
        <div className="border-b border-[#E4E5DE] bg-white px-6 py-4">
          <div className="max-w-2xl rounded-2xl border border-[#E4B4A0] bg-[#FBF1EC] p-5">
            <h3 className="text-sm font-semibold text-[#8A3B1E]">Couldn&rsquo;t load this intake</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[#7A4B39]">{firmLiveViewError}</p>
            <p className="mt-1 text-xs text-[#7A4B39]/70">
              This is a connection or access error, not an empty record — the materials are safe.
            </p>
            {onReloadFirmLiveView ? (
              <button
                type="button"
                onClick={() => void onReloadFirmLiveView()}
                className="mt-3 rounded-full border border-[#E4B4A0] bg-white px-4 py-1.5 text-xs font-semibold text-[#8A3B1E] hover:bg-[#FBF1EC]"
              >
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

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
            {demoWorkerName} submitted {firmLiveView?.files.length ?? 0} document{firmLiveView?.files.length === 1 ? '' : 's'} last night.{' '}
            <span className="text-[#7C8B6F]">
              This is what arrived in your review queue — organized, before your first call.
            </span>
          </p>
          <p className="text-xs text-white/38 mt-1">
            Scroll to read the full intake · scattered records arrived structured, before your first call
          </p>
        </div>
      )}

      {/* Content — binder-spine layout (presentation wrapper only) */}
      <div className="px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col lg:flex-row gap-6 items-stretch lg:items-start">
          {/* LEFT SPINE — full-width above the content on mobile/tablet; a sticky side rail only from lg: up */}
          <nav className="w-full lg:w-52 shrink-0 lg:sticky lg:top-4 self-start rounded-[16px] border border-[#E4E5DE] bg-white overflow-hidden">
            <div className="bg-[#F5ECD6] px-4 py-3 border-b border-[#E4D9BC] font-mono">
              <div className="text-[10px] uppercase tracking-[0.14em] text-[#8A7A4E]">Case file</div>
              <div className="text-sm font-semibold text-[#1B2623] mt-0.5 truncate">
                {workerIdentity.name
                  || (isSampleFirmIntakeIdentifier
                    ? SAMPLE_INTAKE_PREVIEW_DISPLAY_LABEL
                    : firmLiveView?.intakeNumber
                      ? `#${firmLiveView.intakeNumber}`
                      : 'Firm review')}
              </div>
              <div className="text-[10px] text-[#8A7A4E]/80 mt-0.5 truncate">
                {workerIdentity.employer ? `${workerIdentity.employer} · ` : ''}
                {reconstructedRecordCount} record{reconstructedRecordCount === 1 ? '' : 's'}
              </div>
            </div>
            <div className="py-2 flex flex-col">
              {TABS.map((t) => {
                const isActive = activeTab === t.id;
                const base = 'flex items-center gap-2.5 px-4 py-2.5 text-sm text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#42574E]';
                const cls = t.accent
                  ? isActive
                    ? 'bg-red-50 text-red-800 border-l-[3px] border-red-600 font-medium'
                    : 'text-red-700/80 hover:bg-[#F5F6F1] border-l-[3px] border-transparent'
                  : isActive
                    ? 'bg-[#EEF1E8] text-[#1B2623] font-medium border-l-[3px] border-[#42574E]'
                    : 'text-[#6A6D66] hover:bg-[#F5F6F1] border-l-[3px] border-transparent';
                const Icon = t.Icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    aria-current={isActive ? 'true' : undefined}
                    className={`${base} ${cls}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* MAIN */}
          <div className="flex-1 min-w-0 flex flex-col gap-6">

            {/* Intake header — a person, not a number. The ownership line shows the attorney the
                one thing the traditional intake never surfaces: a cooperative worker who assembled
                and shared their own record and keeps the original. That cooperation is the benefit. */}
            {useConnectedFirmLayout && firmLiveView && (workerIdentity.name || reconstructedRecordCount > 0) ? (
              <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
                <div>
                  <h1 className="text-[26px] font-semibold leading-tight text-[#1B2623]">
                    {workerIdentity.name || 'Worker intake'}
                  </h1>
                  {workerIdentity.employer ? (
                    <p className="mt-1 text-sm text-[#6A6D66]">{workerIdentity.employer}</p>
                  ) : null}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#D8E0CF] bg-[#F2F5EC] px-3.5 py-2">
                  <HeartHandshake className="h-4 w-4 shrink-0 text-[#42574E]" aria-hidden />
                  <span className="text-[12.5px] leading-snug text-[#42574E]">
                    {workerIdentity.firstName
                      ? `${workerIdentity.firstName} organized and shared these ${reconstructedRecordCount} records — and keeps the originals.`
                      : `Worker-organized · ${reconstructedRecordCount} records shared with you directly.`}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Simple read — the same record as continuous prose instead of a structured, tabbed
                review. Reuses the exact same privacy-tiered payload (firmViewToExportPayload)
                and the same content-building functions already used for the PDF export, so this
                is a second rendering of already-vetted content, not a new data path. */}
            {activeTab === 'simple' && useConnectedFirmLayout && firmLiveView ? (() => {
              const tier = resolveFirmExportAccessTier(firmLiveView);
              const payload = firmViewToExportPayload(firmLiveView, tier);
              const summary = buildExecutiveSummary(payload);
              const chronology = buildPacketChronologyPresentation(payload);
              const account = buildWorkerAccount(payload);
              const onFile = buildReviewTopicBullets(payload);
              const missing = buildMissingRecordBullets(payload);

              return (
                <div className="max-w-[62ch] flex flex-col gap-8 py-2">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-[#8A7A4E]">Simple read</p>
                    <h2 className="mt-1 text-[20px] font-semibold text-[#1B2623]">
                      {workerIdentity.firstName ? `${workerIdentity.firstName}'s record, in plain terms` : 'The record, in plain terms'}
                    </h2>
                    <p className="mt-3 text-[15px] leading-[1.7] text-[#3A3F38]">{summary}</p>
                  </div>

                  {chronology.length > 0 ? (
                    <div>
                      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#6A6D66] mb-3">What happened, in order</h3>
                      <div className="flex flex-col gap-2.5">
                        {chronology.map((e, i) => (
                          <div key={i} className="flex gap-4 text-[14.5px] leading-relaxed">
                            <span className="w-32 shrink-0 font-medium text-[#8A7A4E]">{e.date}</span>
                            <span className="min-w-0 flex-1 text-[#1B2623]">{e.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {account.sections.length > 0 ? (
                    <div>
                      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#6A6D66] mb-3">In the worker&rsquo;s own words</h3>
                      <div className="flex flex-col gap-4">
                        {account.sections.map((s, i) => (
                          <div key={i}>
                            <p className="mb-1 text-[12px] font-medium text-[#8A7A4E]">{s.heading}</p>
                            <p className="text-[14.5px] leading-relaxed text-[#3A3F38]">{s.body}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {onFile.length > 0 || missing.length > 0 ? (
                    <div className="grid grid-cols-1 gap-6 border-t border-[#E4E5DE] pt-6 sm:grid-cols-2">
                      {onFile.length > 0 ? (
                        <div>
                          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#6A6D66] mb-3">On file</h3>
                          <ul className="flex flex-col gap-1.5 text-[14px] text-[#3A3F38]">
                            {onFile.map((b, i) => (
                              <li key={i} className="flex gap-2"><span className="text-[#42574E]">&middot;</span>{b}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      {missing.length > 0 ? (
                        <div>
                          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-[#6A6D66] mb-3">Not yet on file</h3>
                          <ul className="flex flex-col gap-1.5 text-[14px] text-[#3A3F38]">
                            {missing.map((b, i) => (
                              <li key={i} className="flex gap-2"><span className="text-[#8A7A4E]">&middot;</span>{b}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <p className="border-t border-[#E4E5DE] pt-4 text-[11px] leading-relaxed text-[#8A8F86]">
                    This is the same record shown in the other tabs, written as continuous prose instead
                    of a structured review. It organizes and reflects — it draws no conclusions.
                  </p>
                </div>
              );
            })() : null}

            {/* Call-prep checklist — the PDF's "Priority Questions" section, packaged as an
                interactive checklist for the actual client call. Thin UI layer on top of
                buildPriorityQuestionsForView; no new question-generation logic. Session-local
                check state only — not persisted, not worker-facing. */}
            {activeTab === 'decision' && useConnectedFirmLayout && firmLiveView ? (() => {
              const questions = buildPriorityQuestionsForView(firmLiveView);
              if (questions.length === 0) return null;
              return (
                <div className="rounded-[18px] border border-[#D8E0CF] bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#42574E]">
                    Call-prep checklist
                  </p>
                  <p className="mt-1 text-xs text-[#6A6D66]">
                    Worth asking on the first call, based on what&rsquo;s on file. Check off as you go —
                    this list isn&rsquo;t saved, it&rsquo;s just for you right now.
                  </p>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {questions.map((q, i) => {
                      const checked = checkedPrepQuestions.has(i);
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            onClick={() =>
                              setCheckedPrepQuestions((prev) => {
                                const next = new Set(prev);
                                if (next.has(i)) next.delete(i);
                                else next.add(i);
                                return next;
                              })
                            }
                            className="flex w-full items-start gap-2.5 rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-[#F5F6F1]"
                          >
                            <span
                              className={`mt-0.5 flex h-[16px] w-[16px] flex-none items-center justify-center rounded-[4px] border transition-colors ${
                                checked ? 'border-[#42574E] bg-[#42574E]' : 'border-[#C6D0C8] bg-white'
                              }`}
                            >
                              {checked ? <CheckCircle2 className="h-3 w-3 text-white" /> : null}
                            </span>
                            <span className={`text-sm leading-snug ${checked ? 'text-[#6A6D66] line-through' : 'text-[#1B2623]'}`}>
                              {q}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })() : null}

            {/* Case Readiness Snapshot — attorney orientation card */}
            {activeTab === 'decision' && useConnectedFirmLayout && firmLiveView ? (() => {
              // Preview gate (defense-in-depth): the Decision Card never reads the narrative pre-approval.
              const ctx = firmLiveView.previewOnly
                ? ''
                : (firmLiveView.workerProvidedContext ?? firmWorkerStoryDisplay ?? '');
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
              // Show the Decision Card whenever there's ANY decision content — it leads with the
              // records count, the sequence, and key dates even when a name/employer couldn't be
              // parsed from the worker's free text. Only bail when there is genuinely nothing.
              if (!workerName && !employer && reconstructedRecordCount === 0 && timelineForDisplay.length === 0) return null;

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
              // Worker name intentionally omitted here — it leads the intake header above; repeating it inflates the card.
              if (employer) snapshotItems.push({ label: 'Employer', value: employer });
              if (employmentDates) snapshotItems.push({ label: 'Employment Period', value: employmentDates });
              snapshotItems.push({ label: 'Records', value: `${reconstructedRecordCount} document${reconstructedRecordCount === 1 ? '' : 's'}` });
              if (lastDocumentedEvent) snapshotItems.push({ label: lastDocumentedEvent.label, value: lastDocumentedEvent.value });

              // Key dates — parity with the PDF Decision Card. Doctrine: surface EVERY dated report
              // and the termination, never a single inferred "protected activity" anchor. Which report
              // (if any) starts a limitations clock is a legal characterization — the attorney's call,
              // not ours. We show dated facts; counsel decides. "Reports & complaints" matches actual
              // complaint/grievance/concern events only — not warnings (adverse) or witness statements.
              const reportEvts = timelineForDisplay.filter((e) => /\bcomplaint\b|grievance|concern/i.test(e.event));
              const termEvt = timelineForDisplay.find((e) => /terminat|separation/i.test(e.event));

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-[20px] border border-[#E4E5DE] bg-[#1B2623] p-5 shadow-[0_14px_38px_rgba(31,27,75,0.18)]"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#7C8B6F]">Decision Card</p>
                    {reconstructedRecordCount === 0 ? (
                      <span className="inline-flex items-center rounded-full bg-[#C9A24B]/25 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E4C97A]">
                        Records pending
                      </span>
                    ) : null}
                  </div>
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
                          <div key={i} className="flex gap-3 text-sm min-w-0">
                            <span className="w-28 shrink-0 font-medium text-[#7C8B6F]">{e.date}</span>
                            <span className="min-w-0 flex-1 text-white/85 break-words">{e.event}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(reportEvts.length > 0 || termEvt) && (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Key dates for your review</p>
                      <div className="flex flex-wrap gap-x-8 gap-y-2">
                        {reportEvts.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Reports &amp; complaints on file</p>
                            {reportEvts.map((e, i) => (
                              <p key={i} className="text-sm font-medium text-white">{e.date}</p>
                            ))}
                          </div>
                        )}
                        {termEvt && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-0.5">Termination</p>
                            <p className="text-sm font-medium text-white">{termEvt.date}</p>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-[10px] leading-relaxed text-white/35">
                        Surfaced for your timeliness assessment — not a deadline determination.
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })() : null}

            {/* Claim Lens — real element-coverage map on THIS intake's facts. Firm-access-gated;
                counsel-gated before any real firm is given the feature. Organizes, never concludes. */}
            {activeTab === 'claimlens' && useConnectedFirmLayout && firmLiveView ? (
              <ClaimLensPanel
                input={{
                  events: (firmLiveView.events ?? []).map((e) => {
                    // Restore source-linking inside the lens: pull the supporting file the event's
                    // summary names ("Supported by X.pdf") so the item renders source-linked, not
                    // just "on file". Without this the three-state model collapsed to two.
                    const supported = (e.ai_summary ?? '').match(
                      /[Ss]upported by\s+([^.,]+\.(?:pdf|docx?|png|jpe?g))/i
                    );
                    return {
                      title: polishTimelineEventTitle(e.title),
                      date: e.event_date,
                      category: e.category,
                      sourceFile: supported?.[1]?.trim() ?? null,
                    };
                  }),
                  quotes: (firmLiveView.intelligence?.keyQuotes ?? []).map((q) => ({
                    quote: q.quote,
                    fileName: q.file_name,
                    category: q.category,
                  })),
                  intervals: (firmLiveView.intelligence?.timingIntervals ?? []).map((iv) => ({
                    label: iv.label,
                    days: iv.days,
                    description: iv.description,
                  })),
                  confirmed: (() => {
                    const it = firmLiveView.intelligence;
                    if (!it) return [];
                    const c: Array<{ label: string; value: string }> = [];
                    if (it.confirmedComplaintTopic) c.push({ label: 'HR complaint topic', value: it.confirmedComplaintTopic });
                    if (it.confirmedComplaintDate) c.push({ label: 'Complaint date', value: it.confirmedComplaintDate });
                    if (it.confirmedHrResponseSummary) c.push({ label: 'HR response', value: it.confirmedHrResponseSummary });
                    if (it.confirmedWarningReason) c.push({ label: 'Written warning states', value: it.confirmedWarningReason });
                    if (it.confirmedTerminationReason) c.push({ label: 'Termination states', value: it.confirmedTerminationReason });
                    return c;
                  })(),
                  // Preview gate (defense-in-depth): the lens never receives the narrative pre-approval.
                  workerContext: firmLiveView.previewOnly
                    ? ''
                    : firmLiveView.workerProvidedContext ?? firmWorkerStoryDisplay ?? '',
                  files: (firmLiveView.files ?? []).map((f) => ({ fileName: f.file_name, category: f.category })),
                }}
                onOpenSource={(fileName, snippet) => void openQuoteCitation(fileName, snippet)}
              />
            ) : null}

            {/* 3-Minute Review Layer — fast triage signal for attorneys */}
            {activeTab === 'decision' && useConnectedFirmLayout && firmLiveView ? (() => {
              // Preview gate (defense-in-depth): no "worker narrative provided" signal pre-approval.
              const hasStory =
                !firmLiveView.previewOnly &&
                Boolean(firmLiveView.workerProvidedContext?.trim() || firmWorkerStoryDisplay?.trim());
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
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#42574E] mb-4">At a glance</p>

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
                      {/* Wage-exposure $ tile pulled pending counsel sign-off (valuation/advertising
                          exposure) — organization-only display for now. Restore by flipping to
                          `wageExposure ?` once cleared. See feedback_public_surface_no_conclude. */}
                      {false && wageExposure ? (
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

            {/* Firm Actions relocated to the pinned actions bar at the bottom of this column. */}

            {/* Worker-provided context (persisted in intake summary; not verified fact) */}
            {activeTab === 'context' && useConnectedFirmLayout && firmLiveView ? (
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
            {activeTab === 'context' && !(useConnectedFirmLayout && firmLiveView) ? (
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

            {activeTab === 'context' && (
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
            )}



            {activeTab === 'timeline' && (
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
            )}


            {activeTab === 'documents' && (
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
            )}

            {/* Phase 2B: Extracted facts panel — shown when document intelligence block is present */}
            {activeTab === 'documents' && firmLiveView?.intelligence ? (() => {
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
                            ? 'Time-sensitive dates — attorney review recommended'
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
                          const canOpenSource = demoSourceUrlResolver
                            ? demoSourceUrlResolver(q.file_name) != null
                            : quoteSourceByFileName.has(normalizeFilenameForMatching(q.file_name));
                          return (
                            <div
                              key={q.file_name}
                              role={canOpenSource ? 'button' : undefined}
                              tabIndex={canOpenSource ? 0 : undefined}
                              onClick={canOpenSource ? () => void openQuoteCitation(q.file_name, q.quote) : undefined}
                              onKeyDown={
                                canOpenSource
                                  ? (e) => {
                                      if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        void openQuoteCitation(q.file_name, q.quote);
                                      }
                                    }
                                  : undefined
                              }
                              className={`rounded-lg bg-[#F2F4EC] border border-[#E4E5DE] px-3 py-2 ${
                                canOpenSource
                                  ? 'cursor-pointer transition-colors hover:border-[#42574E] hover:bg-[#EAEFE1] focus:outline-none focus:ring-2 focus:ring-[#D3DED6]'
                                  : ''
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <p className="text-[10px] text-[#42574E]">{q.category.replace(/_/g, ' ')} — {q.file_name.replace(/_/g, ' ').replace(/\.[^.]+$/, '')}</p>
                                {conf && (
                                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${labelStyle}`}>
                                    {extractionLabel}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[#1B2623]/75 italic leading-relaxed">"{q.quote}"</p>
                              {canOpenSource && (
                                <p className="mt-1.5 text-[10px] font-medium text-[#42574E]">↳ Open source — jumps to this line in the file</p>
                              )}
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
            {activeTab === 'gaps' && (() => {
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
            {activeTab === 'gaps' && (() => {
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

            {activeTab === 'gaps' && firmLiveView?.documentRequest?.categories?.length ? (() => {
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
            {activeTab === 'gaps' &&
            !firmLiveView?.documentRequest?.categories?.length &&
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

            {/* Methodology statement — attorney trust layer. Lives on the Decision card only. */}
            {activeTab === 'decision' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-[16px] border border-[#E4E5DE]/60 bg-[#FAF9F6] px-5 py-4"
            >
              <p className="text-[11px] leading-relaxed text-[#1B2623]/52">
                <span className="font-medium text-[#1B2623]/70">How this was organized:</span> one3seven structures the worker's own records — dates, context, and categories — into a reviewable file for you to confirm against the sources. It does not score, conclude, or predict outcomes.
              </p>
            </motion.div>
            )}

            {activeTab === 'context' && (
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
            )}





            {wageExposure ? (
              <div className="mt-4">
                <WageExposureReviewSection wage={wageExposure} onOpenCitation={setOpenCitation} />
              </div>
            ) : null}






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

            {/* Demo sign-up card — appears after the attorney has read the full intake. Decision card only. */}
            {demoMode && activeTab === 'decision' && (
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
                  <p className="text-[10px] text-white/28 mt-4">No card required · Starter from $350/mo after trial</p>
                </div>
              </motion.div>
            )}

            {/* PINNED ACTIONS BAR — Firm Actions relocated here (shows on every tab).
                Contains its own horizontal scroll on narrow screens so this bar can never force
                the page itself to overflow, regardless of how many actions are present at once. */}
            <div className="sticky bottom-0 z-10 mt-2 rounded-2xl border border-[#E4E5DE] bg-white/95 px-4 py-3 shadow-[0_-6px_24px_rgba(31,27,75,0.06)] backdrop-blur max-w-full overflow-x-auto">
              <div className="flex flex-nowrap sm:flex-wrap items-center gap-2 min-w-max sm:min-w-0">
                <span className="mr-1 hidden text-[11px] font-semibold uppercase tracking-wider text-[#7C857F] sm:inline">
                  Firm actions
                </span>
                <button
                  onClick={handleDownloadSummary}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42574E] focus-visible:ring-offset-1 ${FIRM_REVIEW_SECONDARY_BUTTON}`}
                >
                  <Download className="h-4 w-4" aria-hidden />
                  Download summary
                </button>
                {/* AI extraction runs automatically in the background — no button needed */}
                {firmLiveView?.routeStatus === 'full_access' && onReloadFirmLiveView ? (
                  <button
                    type="button"
                    onClick={() => void onReloadFirmLiveView()}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#E4E5DE] bg-white px-4 py-2.5 text-sm font-medium text-[#1B2623] transition-colors hover:border-[#7C8B6F] hover:bg-[#F2F4EC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42574E] focus-visible:ring-offset-1"
                  >
                    <FileText className="h-4 w-4" aria-hidden />
                    Review files
                  </button>
                ) : null}
                {onRequestAdditionalDocuments ? (
                  <button
                    type="button"
                    onClick={openFirmDocRequestModal}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42574E] focus-visible:ring-offset-1 ${FIRM_REVIEW_SECONDARY_BUTTON}`}
                  >
                    Request documents
                  </button>
                ) : null}
                {onAddWorkerReminder && firmLiveView?.routeStatus === 'full_access' ? (
                  <button
                    type="button"
                    onClick={openAddReminderModal}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#42574E] focus-visible:ring-offset-1 ${FIRM_REVIEW_SECONDARY_BUTTON}`}
                  >
                    <CalendarPlus className="h-4 w-4" aria-hidden />
                    Add a date
                  </button>
                ) : null}
                {/* The decision itself, anchored to the right so it reads as the primary action. */}
                <div className="ml-auto flex items-center gap-2">
                  {firmLiveView?.routeStatus === 'full_access' && !isFirmAccepted && !isFirmDeclined ? (
                    <>
                      {onAcceptIntake ? (
                        <button
                          onClick={() => void handleAcceptIntake()}
                          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1B2623] focus-visible:ring-offset-2 ${FIRM_REVIEW_PRIMARY_BUTTON}`}
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden />
                          Accept
                        </button>
                      ) : null}
                      {onDeclineIntake ? (
                        <button
                          onClick={() => setShowDeclineConfirm(true)}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#E4E5DE] bg-white px-4 py-2.5 text-sm font-medium text-[#6A6D66] transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
                        >
                          Not pursuing
                        </button>
                      ) : null}
                    </>
                  ) : isFirmAccepted || firmLiveView?.routeStatus === 'accepted' ? (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      Added for follow-up
                    </span>
                  ) : isFirmDeclined ? (
                    <span className="inline-flex items-center gap-2 rounded-xl border border-[#E4E5DE] bg-[#FAF9F6] px-4 py-2.5 text-sm font-medium text-[#7C857F]">
                      Marked as not pursuing
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
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
                className="w-full mb-4 px-3 py-2 border border-[#E4E5DE] rounded-lg text-sm h-24 resize-none text-[#1B2623]"
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

      {/* Add a reminder/date for the worker (firm -> worker). Same doctrine as the worker's own
          reminders: a plain logistics item, never a computed legal deadline. Shows up on the
          worker's dashboard tagged "from your firm". */}
      <AnimatePresence>
        {showAddReminderModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#1B2623]/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeAddReminderModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl"
            >
              <h3 className="text-lg font-semibold text-[#1B2623] mb-2">Add a date for the worker</h3>
              <p className="text-sm text-[#6A6D66] mb-4">
                Shows up on their dashboard, tagged as from your firm. This is a plain logistics
                note — one3seven does not calculate legal deadlines, so set the date yourself.
              </p>
              {addReminderError ? (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                  {addReminderError}
                </p>
              ) : null}
              <label className="text-sm font-medium text-[#1B2623] mb-1 block">What is this for?</label>
              <textarea
                value={reminderText}
                onChange={(e) => {
                  setReminderText(e.target.value);
                  if (addReminderError) setAddReminderError(null);
                }}
                className="w-full mb-4 px-3 py-2 border border-[#E4E5DE] rounded-lg text-sm h-20 resize-none text-[#1B2623]"
                placeholder="e.g. Deposition, examination appointment, records due back"
                disabled={addReminderSubmitting}
              />
              <label className="text-sm font-medium text-[#1B2623] mb-1 block">Date (optional)</label>
              <input
                type="date"
                value={reminderDueDate}
                onChange={(e) => setReminderDueDate(e.target.value)}
                className="w-full mb-4 px-3 py-2 border border-[#E4E5DE] rounded-lg text-sm text-[#1B2623]"
                disabled={addReminderSubmitting}
              />
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleSubmitAddReminder();
                }}
              >
                <button
                  type="submit"
                  disabled={addReminderSubmitting || !onAddWorkerReminder}
                  className="flex-1 bg-[#42574E] text-white py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {addReminderSubmitting ? 'Adding…' : 'Add reminder'}
                </button>
                <button
                  type="button"
                  onClick={closeAddReminderModal}
                  disabled={addReminderSubmitting}
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
        signedUrl={openCitation ? citationUrls[openCitation.docId] ?? quoteCitationUrl : null}
        onClose={() => {
          setOpenCitation(null);
          setQuoteCitationUrl(null);
        }}
      />
    </div>
  );
}
