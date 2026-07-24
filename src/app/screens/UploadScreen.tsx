import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Upload,
  Camera,
  FileText,
  Mail,
  Calendar,
  DollarSign,
  CheckCircle2,
  ArrowLeft,
  Clock,
  Briefcase,
  Loader2,
  X,
  Edit3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Screen } from '../App';
import {
  EMPLOYMENT_STATUS_OPTIONS,
  US_STATES,
  STORY_FIRST_FOLLOWUP_HEADING,
  STORY_FIRST_FOLLOWUP_SUBLINE,
  STORY_FIRST_STEP_LABELS,
  STORY_FIRST_UPLOAD_EXAMPLES,
  STORY_FIRST_UPLOAD_HEADING,
  STORY_FIRST_UPLOAD_INTRO,
  STORY_FIRST_UPLOAD_NOTICE,
  WORKER_UPLOAD_SOURCING_GUIDANCE,
  type StoryFollowUpAnswers,
} from '../constants/workerStoryIntake';
import {
  inferCategoryFromFileName,
  listCompletedExtractionsForIntake,
  resolveUploadedFileDisplayCategory,
  type UploadedFilePersistMetaRow,
} from '../../services/intakeDataService';
import { WorkerDocumentRequestPanel } from '../components/WorkerDocumentRequestPanel';
import {
  buildWorkerDocumentRequestView,
  formatDocumentRequestDateLabel,
  getWorkerDocumentRequestStatus,
} from '../utils/workerDocumentRequest';
import { WORKER_DOC_REQUEST_PANEL_COPY, WORKER_UPLOAD_COPY } from '../constants/workerIntakePresentation';
import { One3SevenDisclaimer } from '../components/One3SevenDisclaimer';
import { suggestAttorneyFriendlyFileTitle } from '../../services/documentFactExtractionService';
import { NotificationsBell } from '../components/NotificationsBell';
import type { AppNotificationItem } from '../components/NotificationsBell';
import { WordMark } from '../components/WordMark';

const UPLOAD_PAGE_SHELL =
  'min-h-screen bg-[#f2f4ec] text-[#111827] selection:bg-[#CBD6CF]/70 selection:text-[#111827]';
const UPLOAD_NAV_TOP = 'sticky top-0 z-40 border-b border-[#D3DED6]/80 bg-white/88 backdrop-blur-xl';
const UPLOAD_NAV_BRAND =
  'text-[15px] font-semibold tracking-tight text-[#1B2623] hover:text-[#42574E] transition-colors';
const UPLOAD_NAV_ACTION =
  'rounded-full border border-[#D3DED6] bg-white px-3 py-1.5 text-xs font-semibold text-[#2C332E] shadow-sm transition-colors hover:border-[#CBD6CF] hover:bg-[#EEF2EE]';
const UPLOAD_ZONE_LIGHT =
  'border border-dashed border-[#CBD6CF] bg-white shadow-[0_18px_48px_rgba(66,87,78,0.10)] hover:border-[#9AA39B] hover:bg-[#EEF2EE]/45';
const UPLOAD_PRIMARY_CTA =
  'bg-[#42574E] text-white shadow-[0_14px_34px_rgba(66,87,78,0.24)] hover:bg-[#374A42]';
const UPLOAD_SECONDARY_CTA =
  'border border-[#D3DED6] bg-white text-[#2C332E] shadow-sm hover:border-[#CBD6CF] hover:bg-[#EEF2EE]';
const UPLOAD_DISABLED_CTA = 'bg-[#D3DED6] text-[#9AA39B] cursor-not-allowed';

function hasMeaningfulStoryInput(text: string | null | undefined): boolean {
  const normalized = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  return normalized.length >= 12 || normalized.split(/\s+/).length >= 3;
}

interface UploadScreenProps {
  onNavigate: (screen: Screen) => void;
  uploadedFiles: File[];
  setUploadedFiles: (files: File[]) => void;
  onLogoClick: () => void;
  hasCompletedIntake: boolean;
  /** Called before navigating to processing; optional upload-step context for intake summary / export. */
  onProcessingComplete: (detail?: {
    uploadContext?: string;
    routeLinkedFirmAfterProcessing?: boolean;
  }) => void;
  /** Persist new files to Supabase Storage + uploaded_files (optional). */
  onPersistNewFiles?: (newFiles: File[]) => Promise<void>;
  /** When set, rename/delete also update Supabase for rows created this session. */
  onRenameUploadedFile?: (index: number, newName: string) => Promise<{ error?: string }>;
  onDeleteUploadedFile?: (index: number) => Promise<{ error?: string }>;
  /** Aligned with `uploadedFiles` indices for extraction polling / title suggestions. */
  uploadedFilePersistMeta?: Array<UploadedFilePersistMetaRow | null>;
  /** Safety: Supabase signed-in worker on upload without an intake row (persistence is disabled). */
  supabaseWorkerIntakeMissing?: boolean;
  /** When set with handlers, shows firm-code gate before processing (Supabase beta). */
  activeIntakeId?: string | null;
  onLookupFirmCode?: (code: string) => Promise<{ id: string; firm_name: string } | null>;
  onLinkFirmToIntake?: (firmId: string) => Promise<{ error?: string }>;
  /** Link firm code before organization (intake row only; does not start processing). */
  onPrelinkFirmCode?: (code: string) => Promise<{ error?: string; firmName?: string }>;
  activeIntakeLinkedFirmName?: string | null;
  /** After the first-run law-firm choice (or when intake already has a summary), skip the upload firm-code gate modal. */
  suppressUploadFirmGate?: boolean;
  /** Intake already has a generated summary (Supabase list). */
  intakeHasGeneratedSummary?: boolean;
  onOpenWorkerSettings?: () => void;
  onWorkerSignOut?: () => void;
  workerBellNotifications?: AppNotificationItem[];
  notificationsPanelNotice?: string;
  /** After worker law-firm modal: skip gate, open code step first, or default upload gate */
  workerFirmOrganizeIntent?: 'default' | 'skip_firm_gate' | 'enter_firm_code_first';
  /** Firm document request from current intake summary (Supabase worker live bundle). */
  liveOverview?: string;
  liveMissing?: string[];
  workerWorkflowStatus?: string | null;
  /** From persistent firm_document_request notification (upload checklist UI later). */
  documentRequestPayload?: {
    requested_categories: string[];
    firm_note: string;
    firm_name: string;
  } | null;
  /** Create Supabase intake row from session onboarding before organize / upload persist. */
  onEnsureWorkerIntakePersisted?: () => Promise<boolean>;
  /** First-run upload: save onboarding as draft without organizing yet. */
  showSaveIntakeDraft?: boolean;
  onSaveIntakeDraft?: () => Promise<boolean>;
  /** Story captured on the prior intake step (read-only recap). */
  workerStoryPreview?: string | null;
  storyFollowUp?: StoryFollowUpAnswers;
  onStoryFollowUpChange?: (answers: StoryFollowUpAnswers) => void;
  docRequestUploadScrollSignal?: number;
  intakeUpdatedAt?: string;
  onOpenIntakeSummary?: () => void;
  shellMode?: boolean;
}

export function UploadScreen({
  onNavigate,
  uploadedFiles,
  setUploadedFiles,
  onLogoClick,
  hasCompletedIntake,
  onProcessingComplete,
  onPersistNewFiles,
  onRenameUploadedFile,
  onDeleteUploadedFile,
  uploadedFilePersistMeta = [],
  supabaseWorkerIntakeMissing = false,
  activeIntakeId,
  onLookupFirmCode,
  onLinkFirmToIntake,
  onPrelinkFirmCode,
  activeIntakeLinkedFirmName = null,
  onOpenWorkerSettings,
  onWorkerSignOut,
  workerBellNotifications = [],
  notificationsPanelNotice,
  workerFirmOrganizeIntent = 'default',
  intakeHasGeneratedSummary = false,
  suppressUploadFirmGate = false,
  liveOverview,
  liveMissing,
  workerWorkflowStatus,
  documentRequestPayload,
  onEnsureWorkerIntakePersisted,
  showSaveIntakeDraft = false,
  onSaveIntakeDraft,
  workerStoryPreview = null,
  storyFollowUp,
  onStoryFollowUpChange,
  docRequestUploadScrollSignal = 0,
  intakeUpdatedAt,
  onOpenIntakeSummary,
  shellMode = false,
}: UploadScreenProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const [showFollowUpDetails, setShowFollowUpDetails] = useState(true);
  const [showStoryPreview, setShowStoryPreview] = useState(false);
  const [followUp, setFollowUp] = useState<StoryFollowUpAnswers>(
    storyFollowUp ?? {
      employmentName: '',
      employer: '',
      employmentDates: '',
      keyPeople: '',
      workedRemotely: '',
      remoteExpenses: '',
      reimbursed: '',
      complainedOrReported: '',
      changedAfterward: '',
      employmentStatus: '',
      arbitrationAgreement: '',
      priorAgencyFiling: '',
      priorAgencyFilingDetails: '',
    }
  );
  const isEmploymentIntake = (() => {
    if (!activeIntakeId) return false;
    try {
      const raw = localStorage.getItem(`o3s_case_category_v1_${activeIntakeId}`)?.trim().toLowerCase() ?? '';
      return raw.includes('employ');
    } catch {
      return false;
    }
  })();
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showAllFiles, setShowAllFiles] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [saveDraftBusy, setSaveDraftBusy] = useState(false);
  const [showFirmGateModal, setShowFirmGateModal] = useState(false);
  const [firmGateStep, setFirmGateStep] = useState<'intro' | 'code'>('intro');
  const [firmCodeDraft, setFirmCodeDraft] = useState('');
  const [firmGateError, setFirmGateError] = useState('');
  const [linkedFirmPreview, setLinkedFirmPreview] = useState<{ id: string; firm_name: string } | null>(null);
  const [firmGateBusy, setFirmGateBusy] = useState(false);
  const [prelinkCodeDraft, setPrelinkCodeDraft] = useState('');
  const [prelinkBusy, setPrelinkBusy] = useState(false);
  const [prelinkError, setPrelinkError] = useState('');
  const [prelinkToast, setPrelinkToast] = useState<string | null>(null);
  const [persistActionError, setPersistActionError] = useState<string | null>(null);
  const [suppressedSuggestionKeys, setSuppressedSuggestionKeys] = useState<Set<string>>(() => new Set());
  const [extractionByFileId, setExtractionByFileId] = useState<
    Map<string, { extracted_text: string; category: string | null }>
  >(() => new Map());
  const [titleSuggestBusyIndex, setTitleSuggestBusyIndex] = useState<number | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** Files from the current picker/drop action, shown until persist + hydrate finish. */
  const [pendingUploadFiles, setPendingUploadFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (storyFollowUp) setFollowUp(storyFollowUp);
  }, [storyFollowUp]);

  const updateFollowUp = (patch: Partial<StoryFollowUpAnswers>) => {
    setFollowUp((prev) => {
      const next = { ...prev, ...patch };
      onStoryFollowUpChange?.(next);
      return next;
    });
  };

  const UPLOAD_CONSENT_NOTICE = STORY_FIRST_UPLOAD_NOTICE;

  const openFilePicker = (source: 'upload_area' | 'select_documents' | 'camera') => {
    console.info('[o3s-upload-ui] upload button clicked', { source });
    if (source === 'camera') {
      cameraInputRef.current?.click();
      return;
    }
    fileInputRef.current?.click();
  };

  const readPickedFiles = (fileList: FileList | null, source: 'picker' | 'camera'): File[] => {
    console.info('[o3s-upload-ui] input change fired', { source });
    const picked = fileList ? Array.from(fileList) : [];
    console.info('[o3s-upload-ui] picker selected count', { count: picked.length, source });
    console.info('[o3s-upload-ui] picker selected filenames', {
      filenames: picked.map((file) => file.name),
      source,
    });
    return picked;
  };

  const firmDocRequest = useMemo(
    () =>
      buildWorkerDocumentRequestView(
        documentRequestPayload,
        liveOverview,
        liveMissing,
        activeIntakeLinkedFirmName
      ),
    [documentRequestPayload, liveOverview, liveMissing, activeIntakeLinkedFirmName]
  );
  const docRequestStatus = getWorkerDocumentRequestStatus(workerWorkflowStatus);
  const docRequestFocusMode = Boolean(docRequestStatus && intakeHasGeneratedSummary);
  const requestDateLabel = formatDocumentRequestDateLabel(intakeUpdatedAt);
  const showCompletedDocRequestState =
    docRequestStatus === 'uploaded' || docRequestStatus === 'submitted';
  const firmDocRequestForPanel =
    firmDocRequest ??
    (docRequestFocusMode
      ? {
          categories: [] as string[],
          note: '',
          firmName: (activeIntakeLinkedFirmName ?? '').trim() || null,
        }
      : null);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!docRequestUploadScrollSignal || !docRequestFocusMode) return;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const t = window.setTimeout(() => {
      document.getElementById('worker-doc-request-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 120);
    return () => window.clearTimeout(t);
  }, [docRequestUploadScrollSignal, docRequestFocusMode]);

  useEffect(() => {
    if (docRequestFocusMode) setShowFollowUpDetails(false);
  }, [docRequestFocusMode]);

  useEffect(() => {
    if (!supabaseWorkerIntakeMissing) return;
    console.warn(
      '[one3seven] UploadScreen is open for a signed-in worker in Supabase mode without currentIntakeId; new files will not persist until an intake is created.'
    );
  }, [supabaseWorkerIntakeMissing]);

  useEffect(() => {
    console.info('[o3s-intake] UploadScreen activeIntakeId', {
      activeIntakeId,
      uploadedFilesCount: uploadedFiles.length,
    });
    setPrelinkCodeDraft('');
    setPrelinkError('');
    setPrelinkToast(null);
    setLinkedFirmPreview(null);
    setFirmCodeDraft('');
    setExtractionByFileId(new Map());
    setSuppressedSuggestionKeys(new Set());
    setRenamingIndex(null);
    setRenameValue('');
    setShowAllFiles(false);
    setIsUploading(false);
    setPersistActionError(null);
    setUploadFeedback(null);
    setUploadError(null);
    setPendingUploadFiles([]);
  }, [activeIntakeId]);

  useEffect(() => {
    if (!activeIntakeId) return;
    let alive = true;
    const poll = async () => {
      const { rows } = await listCompletedExtractionsForIntake(activeIntakeId);
      if (!alive) return;
      const next = new Map<string, { extracted_text: string; category: string | null }>();
      for (const row of rows) {
        next.set(row.uploaded_file_id, {
          extracted_text: row.extracted_text,
          category: row.uploaded_files?.category ?? null,
        });
      }
      setExtractionByFileId(next);
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, [activeIntakeId, uploadedFiles.length]);

  useEffect(() => {
    setSuppressedSuggestionKeys((prev) => {
      let changed = false;
      const next = new Set(prev);
      uploadedFilePersistMeta.forEach((meta, index) => {
        if (!meta?.uploadedFileId) return;
        const file = uploadedFiles[index];
        if (!file) return;
        const localKey = `local:${index}:${file.size}`;
        const ufKey = `uf:${meta.uploadedFileId}`;
        if (prev.has(localKey) && !prev.has(ufKey)) {
          next.add(ufKey);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [uploadedFilePersistMeta, uploadedFiles]);

  const handleSaveForLater = async () => {
    // Simulate save process
    await new Promise((resolve) => setTimeout(resolve, 500));
    setShowSaveConfirmation(true);
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setShowSaveConfirmation(false);
    }, 5000);
  };

  const handleDismissSave = () => {
    setShowSaveConfirmation(false);
  };

  const proceedToProcessing = async (detail?: { routeLinkedFirmAfterProcessing?: boolean }) => {
    if (onEnsureWorkerIntakePersisted) {
      const ok = await onEnsureWorkerIntakePersisted();
      if (!ok) return;
    }
    onProcessingComplete(detail);
    onNavigate('processing');
  };

  const handlePrelinkFirmCode = async () => {
    if (!onPrelinkFirmCode || !prelinkCodeDraft.trim()) {
      setPrelinkError('Enter a firm code.');
      return;
    }
    setPrelinkBusy(true);
    setPrelinkError('');
    setPrelinkToast(null);
    const r = await onPrelinkFirmCode(prelinkCodeDraft);
    setPrelinkBusy(false);
    if (r.error) {
      setPrelinkError(r.error);
      return;
    }
    const name = r.firmName?.trim() || 'your firm';
    setPrelinkToast(`Your intake is now linked to ${name}`);
    setPrelinkCodeDraft('');
    window.setTimeout(() => setPrelinkToast(null), 6000);
  };

  const handleSaveIntakeDraft = async () => {
    if (!onSaveIntakeDraft) return;
    setSaveDraftBusy(true);
    try {
      const ok = await onSaveIntakeDraft();
      if (!ok) return;
      setShowSaveConfirmation(true);
      window.setTimeout(() => setShowSaveConfirmation(false), 5000);
    } finally {
      setSaveDraftBusy(false);
    }
  };

  const hasMeaningfulStoryContext =
    hasMeaningfulStoryInput(workerStoryPreview) ||
    hasMeaningfulStoryInput(followUp.complainedOrReported) ||
    hasMeaningfulStoryInput(followUp.changedAfterward);
  const canBeginOrganization = uploadedFiles.length > 0 || hasMeaningfulStoryContext;

  const handleBeginOrganization = () => {
    if (!canBeginOrganization) return;
    if (workerFirmOrganizeIntent === 'skip_firm_gate') {
      void proceedToProcessing();
      return;
    }
    if (intakeHasGeneratedSummary || suppressUploadFirmGate || activeIntakeLinkedFirmName?.trim()) {
      void proceedToProcessing();
      return;
    }
    const canUseFirmCodeGate =
      (Boolean(activeIntakeId) || Boolean(onEnsureWorkerIntakePersisted)) &&
      Boolean(onLookupFirmCode) &&
      Boolean(onLinkFirmToIntake);
    if (workerFirmOrganizeIntent === 'enter_firm_code_first' && canUseFirmCodeGate) {
      setFirmGateError('');
      setFirmCodeDraft('');
      setLinkedFirmPreview(null);
      setFirmGateStep('code');
      setShowFirmGateModal(true);
      return;
    }
    if (canUseFirmCodeGate) {
      setFirmGateError('');
      setFirmCodeDraft('');
      setLinkedFirmPreview(null);
      setFirmGateStep('intro');
      setShowFirmGateModal(true);
      return;
    }
    void proceedToProcessing();
  };

  const handleFirmGateContinueWithout = () => {
    setShowFirmGateModal(false);
    setFirmGateStep('intro');
    void proceedToProcessing();
  };

  const handleFirmGateLookup = async () => {
    if (!onLookupFirmCode || !firmCodeDraft.trim()) {
      setFirmGateError('Enter a firm code.');
      return;
    }
    setFirmGateBusy(true);
    setFirmGateError('');
    const res = await onLookupFirmCode(firmCodeDraft);
    setFirmGateBusy(false);
    if (!res) {
      setLinkedFirmPreview(null);
      setFirmGateError('Firm code not found. Check the code and try again.');
      return;
    }
    setLinkedFirmPreview(res);
  };

  const handleFirmGateConfirmLinked = async () => {
    if (!linkedFirmPreview || !onLinkFirmToIntake) return;
    if (!activeIntakeId && onEnsureWorkerIntakePersisted) {
      const ok = await onEnsureWorkerIntakePersisted();
      if (!ok) return;
    }
    if (!activeIntakeId && !onEnsureWorkerIntakePersisted) return;
    setFirmGateBusy(true);
    setFirmGateError('');
    const r = await onLinkFirmToIntake(linkedFirmPreview.id);
    setFirmGateBusy(false);
    if (r.error) {
      setFirmGateError(r.error);
      return;
    }
    setShowFirmGateModal(false);
    setFirmGateStep('intro');
    void proceedToProcessing({ routeLinkedFirmAfterProcessing: true });
  };

  const handleFileUpload = async (incomingFiles: File[], source: 'picker' | 'drop' | 'camera') => {
    // Accept PDFs and phone photos/images. Images aren't text-extracted yet (OCR is coming), but
    // they're the worker's actual evidence — we save them as records so the worker is never blocked,
    // and text extraction skips them gracefully (fileTextExtractionService returns early on non-PDF).
    // The accept attribute restricts the picker, but drag-and-drop bypasses it, so we re-check here;
    // only truly unsupported types (Word/Excel/etc.) are rejected.
    const SUPPORTED_EXT = /\.(pdf|jpe?g|png|heic|heif|webp)$/i;
    const isSupported = (f: File) =>
      f.type === 'application/pdf' || f.type.startsWith('image/') || SUPPORTED_EXT.test(f.name);
    const filesToUpload = incomingFiles.filter(isSupported);
    const rejectedCount = incomingFiles.length - filesToUpload.length;

    if (filesToUpload.length === 0) {
      if (rejectedCount > 0) {
        setUploadError("That file type isn't supported yet. You can add a PDF or a photo (JPG, PNG, or HEIC).");
      } else {
        console.warn('[o3s-upload-ui] handleFileUpload skipped: empty selection', { source });
      }
      return;
    }

    console.info('[o3s-upload-ui] handleFileUpload start', {
      source,
      newlySelectedCount: filesToUpload.length,
      existingDbFileCount: uploadedFiles.length,
      filenames: filesToUpload.map((file) => file.name),
    });

    setPendingUploadFiles(filesToUpload);
    setShowPulse(true);
    setTimeout(() => setShowPulse(false), 1000);

    setUploadError(
      rejectedCount > 0
        ? `${rejectedCount === 1 ? 'One file was' : `${rejectedCount} files were`} skipped — we support PDFs and photos (JPG, PNG, HEIC) right now. Your other ${filesToUpload.length === 1 ? 'file was' : 'files were'} added.`
        : null,
    );
    setIsUploading(true);

    if (!onPersistNewFiles) {
      console.warn(
        '[o3s-upload] onPersistNewFiles missing: files are local-only and will not persist to Supabase.'
      );
      setUploadFeedback(`${filesToUpload.length} file${filesToUpload.length === 1 ? '' : 's'} added`);
      window.setTimeout(() => setUploadFeedback(null), 2600);
      setUploadedFiles([...uploadedFiles, ...filesToUpload]);
      setPendingUploadFiles([]);
      setIsUploading(false);
      return;
    }

    try {
      await onPersistNewFiles(filesToUpload);
      const savedCount = filesToUpload.length;
      setUploadFeedback(`${savedCount} file${savedCount === 1 ? '' : 's'} saved`);
      window.setTimeout(() => setUploadFeedback(null), 2600);
      console.info('[o3s-upload-ui] handleFileUpload complete', {
        source,
        newlySelectedCount: filesToUpload.length,
      });
    } catch (e) {
      console.error('[o3s-upload-ui] handleFileUpload failed', {
        source,
        error: e instanceof Error ? e.message : String(e),
      });
      const message =
        e instanceof Error ? e.message : 'Could not save one or more files. Please try again.';
      setUploadError(message);
    } finally {
      setPendingUploadFiles([]);
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    source: 'picker' | 'camera'
  ) => {
    const input = event.currentTarget;
    const picked = readPickedFiles(input.files, source);
    input.value = '';
    if (picked.length === 0) return;
    void handleFileUpload(picked, source);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    console.info('[o3s-upload-ui] drop event fired');
    const dropped = Array.from(e.dataTransfer.files ?? []);
    console.info('[o3s-upload-ui] drop selected count', { count: dropped.length });
    console.info('[o3s-upload-ui] drop selected filenames', {
      filenames: dropped.map((file) => file.name),
    });
    if (dropped.length === 0) return;
    void handleFileUpload(dropped, 'drop');
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeFile = async (index: number) => {
    setPersistActionError(null);
    if (onDeleteUploadedFile) {
      const r = await onDeleteUploadedFile(index);
      if (r?.error) {
        setPersistActionError(r.error);
        return;
      }
    } else {
      setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const startRename = (index: number, currentName: string) => {
    setPersistActionError(null);
    setRenamingIndex(index);
    setRenameValue(currentName);
  };

  const suggestionFileKey = (index: number, file: File) => {
    const meta = uploadedFilePersistMeta[index];
    if (meta?.uploadedFileId) return `uf:${meta.uploadedFileId}`;
    return `local:${index}:${file.size}`;
  };

  const isSuggestionSuppressed = (index: number, file: File) => {
    const meta = uploadedFilePersistMeta[index];
    if (meta?.uploadedFileId && suppressedSuggestionKeys.has(`uf:${meta.uploadedFileId}`)) {
      return true;
    }
    return suppressedSuggestionKeys.has(suggestionFileKey(index, file));
  };

  const suppressSuggestionsForFile = (index: number, file: File) => {
    const meta = uploadedFilePersistMeta[index];
    setSuppressedSuggestionKeys((prev) => {
      const next = new Set(prev);
      next.add(`local:${index}:${file.size}`);
      if (meta?.uploadedFileId) next.add(`uf:${meta.uploadedFileId}`);
      return next;
    });
  };

  const titleSuggestionForFile = (index: number, file: File): string | null => {
    if (isSuggestionSuppressed(index, file)) return null;
    const meta = uploadedFilePersistMeta[index];
    const extraction = meta?.uploadedFileId ? extractionByFileId.get(meta.uploadedFileId) : undefined;
    const category = resolveUploadedFileDisplayCategory(file, {
      persistedCategory: meta?.category ?? extraction?.category,
    });
    return suggestAttorneyFriendlyFileTitle({
      file_name: file.name,
      category,
      extracted_text: extraction?.extracted_text,
    });
  };

  const acceptTitleSuggestion = async (index: number, suggestion: string) => {
    const file = uploadedFiles[index];
    if (!file) return;
    setPersistActionError(null);
    setTitleSuggestBusyIndex(index);
    if (onRenameUploadedFile) {
      const r = await onRenameUploadedFile(index, suggestion);
      if (r?.error) {
        setPersistActionError(r.error);
        setTitleSuggestBusyIndex(null);
        return;
      }
    } else {
      const newFiles = [...uploadedFiles];
      const row = newFiles[index];
      if (!row) {
        setTitleSuggestBusyIndex(null);
        return;
      }
      newFiles[index] = new File([row], suggestion, { type: row.type });
      setUploadedFiles(newFiles);
    }
    suppressSuggestionsForFile(index, file);
    setTitleSuggestBusyIndex(null);
  };

  const saveRename = async (index: number) => {
    const file = uploadedFiles[index];
    const trimmed = renameValue.trim();
    if (trimmed && file) {
      if (trimmed !== file.name) {
        suppressSuggestionsForFile(index, file);
      }
      if (onRenameUploadedFile) {
        setPersistActionError(null);
        const r = await onRenameUploadedFile(index, trimmed);
        if (r?.error) {
          setPersistActionError(r.error);
          setRenamingIndex(null);
          setRenameValue('');
          return;
        }
      } else {
        const newFiles = [...uploadedFiles];
        const row = newFiles[index];
        if (!row) {
          setRenamingIndex(null);
          setRenameValue('');
          return;
        }
        newFiles[index] = new File([row], trimmed, { type: row.type });
        setUploadedFiles(newFiles);
      }
    }
    setRenamingIndex(null);
    setRenameValue('');
  };

  const categorizeFiles = () => {
    const keys = [
      'Pay Records / Payroll',
      'Time Records',
      'Workplace Communications',
      'Offer Letters',
      'PTO Records',
      'HR Documents',
      'Reimbursement Records',
      'Performance Reviews',
      'Uncategorized',
    ] as const;
    const categories = Object.fromEntries(keys.map((k) => [k, { count: 0, detected: false }])) as Record<
      (typeof keys)[number],
      { count: number; detected: boolean }
    >;
    uploadedFiles.forEach((file, index) => {
      const c = resolveUploadedFileDisplayCategory(file, {
        persistedCategory: uploadedFilePersistMeta[index]?.category,
      });
      const bucket = c in categories ? c : 'Uncategorized';
      categories[bucket].count++;
      categories[bucket].detected = true;
    });
    return categories;
  };

  const categories = categorizeFiles();
  const detectedCategoryLabels = Object.entries(categories)
    .filter(([_, data]) => data.detected)
    .map(([category]) => category);

  const visibleFileEntries = showAllFiles
    ? uploadedFiles.map((file, index) => ({ file, index }))
    : uploadedFiles.slice(0, 3).map((file, index) => ({ file, index }));

  return (
    <div className={UPLOAD_PAGE_SHELL}>
      {/* Top Navigation */}
      {!shellMode ? (
      <nav className={UPLOAD_NAV_TOP}>
        <div className="px-6 py-7 flex items-center justify-between gap-3">
          <button
            onClick={onLogoClick}
            className={UPLOAD_NAV_BRAND}
          >
            <WordMark />
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            <NotificationsBell items={workerBellNotifications} panelNotice={notificationsPanelNotice} />
            {onOpenWorkerSettings ? (
              <button type="button" onClick={onOpenWorkerSettings} className={UPLOAD_NAV_ACTION}>
                Settings
              </button>
            ) : null}
            {onWorkerSignOut ? (
              <button type="button" onClick={onWorkerSignOut} className={UPLOAD_NAV_ACTION}>
                Sign out
              </button>
            ) : null}
          </div>
        </div>
      </nav>
      ) : null}

      {/* Save Confirmation Toast */}
      <AnimatePresence>
        {showSaveConfirmation && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md"
          >
            <div className="rounded-[14px] border border-[#D3DED6] bg-white p-4 text-[#111827] shadow-[0_18px_44px_rgba(66,87,78,0.16)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <div className="text-sm">Your intake workspace has been saved.</div>
              </div>
              <button
                onClick={handleDismissSave}
                className="text-[#7C857F] hover:text-[#42574E] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back Navigation */}
      <div className={`px-5 sm:px-6 ${shellMode ? 'pt-3' : 'pt-4'}`}>
        <button
          type="button"
          onClick={() => onNavigate('landing')}
          className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-[#7C857F] hover:text-[#42574E] transition-colors duration-200 font-normal"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to your dashboard
        </button>
      </div>

      {supabaseWorkerIntakeMissing ? (
        <div className="px-6 pt-4" role="alert">
          <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Your intake is still initializing. File uploads will not save to your workspace until this page finishes
            loading. Try returning to the dashboard and opening upload again, or refresh if this message remains.
          </div>
        </div>
      ) : null}
      {uploadFeedback ? (
        <div className="px-6 pt-3">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
            {uploadFeedback}
          </p>
        </div>
      ) : null}
      {uploadError ? (
        <div className="px-6 pt-3">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
            {uploadError}
          </p>
        </div>
      ) : null}

      {/* Content */}
      <div className={`px-5 sm:px-6 ${shellMode ? 'pt-3' : 'pt-4'} pb-10 max-w-3xl`}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {docRequestFocusMode ? (
            <div className="mb-3">
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-xl font-medium text-[#1B2623] tracking-tight">
                {WORKER_DOC_REQUEST_PANEL_COPY.uploadSectionTitle}
              </h1>
              <p className="text-sm text-[#6A6D66] mt-1 leading-relaxed">
                {WORKER_DOC_REQUEST_PANEL_COPY.uploadSectionHint}
              </p>
            </div>
          ) : (
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-wide text-[#42574E] mb-1">
                {STORY_FIRST_STEP_LABELS.upload}
              </p>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif" }} className="text-xl font-medium text-[#1B2623] tracking-tight">
                {STORY_FIRST_UPLOAD_HEADING}
              </h1>
              <p className="text-sm text-[#6A6D66] mt-1 leading-relaxed">{STORY_FIRST_UPLOAD_INTRO}</p>
              <p className="text-[11px] text-[#40433F] mt-2 leading-relaxed">
                {STORY_FIRST_UPLOAD_EXAMPLES.slice(0, 4).join(' · ')}
                {STORY_FIRST_UPLOAD_EXAMPLES.length > 4 ? ' · …' : ''}
              </p>
              <details className="mt-3 rounded-[12px] border border-[#E4E5DE] bg-[#FAF9F6]/80 px-3 py-2">
                <summary className="cursor-pointer text-[12px] font-medium text-[#384039]">
                  {WORKER_UPLOAD_SOURCING_GUIDANCE.heading}
                </summary>
                <p className="mt-2 text-[11px] text-[#6A6D66] leading-relaxed">
                  {WORKER_UPLOAD_SOURCING_GUIDANCE.intro}
                </p>
                <ul className="mt-1 list-inside list-disc text-[11px] text-[#6A6D66] space-y-1">
                  {WORKER_UPLOAD_SOURCING_GUIDANCE.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-[#7C857F] leading-relaxed">
                  {WORKER_UPLOAD_SOURCING_GUIDANCE.pdfNote}
                </p>
              </details>
            </div>
          )}

          {docRequestFocusMode && firmDocRequestForPanel ? (
            <WorkerDocumentRequestPanel
              request={firmDocRequestForPanel}
              status={docRequestStatus}
              requestDateLabel={requestDateLabel}
              showCompletedState={showCompletedDocRequestState}
            />
          ) : null}

          {/* Upload Area */}
          <div className="mb-5">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf,image/*,.jpg,.jpeg,.png,.heic,.heif,.webp"
              onChange={(e) => handleFileInputChange(e, 'picker')}
              className="hidden"
            />
            <motion.div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => openFilePicker('upload_area')}
              animate={showPulse ? { scale: [1, 1.02, 1] } : {}}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`relative rounded-xl p-6 text-center cursor-pointer transition-all overflow-hidden ${UPLOAD_ZONE_LIGHT} ${
                isDragging ? 'border-[#7C8B6F] bg-[#EEF2EE]' : ''
              }`}
            >
              {/* Glow sweep animation */}
              <AnimatePresence>
                {showPulse && (
                  <motion.div
                    initial={{ opacity: 0, x: '-100%' }}
                    animate={{ opacity: [0, 0.3, 0], x: '100%' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-[#D3DED6]/70 to-transparent"
                  />
                )}
              </AnimatePresence>

              {uploadedFiles.length === 0 ? (
                <>
                  <Upload className="w-10 h-10 text-[#5E7268] mx-auto mb-4" strokeWidth={1.5} />
                  <div className="text-base font-medium text-[#1B2623] mb-2 tracking-tight">
                    Drag and drop files here or browse from your device
                  </div>
                  <div className="inline-block mt-2 px-5 py-2 rounded-lg text-sm font-medium border border-[#D3DED6] bg-white text-[#2C332E] hover:border-[#CBD6CF] hover:bg-[#EEF2EE] transition-colors">
                    Browse files
                  </div>
                  <div className="mt-6 text-xs text-[#7C857F]">
                    PDFs or photos (JPG, PNG, HEIC) — no need to convert
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Success indicator */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="flex items-center gap-2 text-[#1B2623]">
                      <CheckCircle2 className="w-5 h-5" />
                      <span className="text-base font-medium">Files uploaded successfully</span>
                    </div>

                    {detectedCategoryLabels.length > 0 ? (
                      <p className="text-xs text-[#6A6D66] text-center max-w-sm">
                        one3seven identified {detectedCategoryLabels.length}{' '}
                        {detectedCategoryLabels.length === 1 ? 'type' : 'types'} from your files (for example:{' '}
                        {detectedCategoryLabels.slice(0, 2).join(', ')}
                        {detectedCategoryLabels.length > 2 ? '…' : ''}).
                      </p>
                    ) : null}
                  </motion.div>

                  <div className="text-sm text-[#6A6D66]">
                    Drop more files or click to add
                  </div>
                </div>
              )}
            </motion.div>

          </div>

          {/* Uploading State */}
          <AnimatePresence>
            {(isUploading || pendingUploadFiles.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 rounded-xl border border-[#D3DED6] bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3 mb-2">
                  {isUploading ? (
                    <Loader2 className="w-5 h-5 text-[#42574E] animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-[#42574E]" />
                  )}
                  <span className="text-sm text-[#1B2623] font-medium">
                    {isUploading ? 'Uploading documents…' : 'Ready to upload'}
                  </span>
                </div>
                <div className="text-xs text-[#6A6D66] mb-3">
                  {pendingUploadFiles.length}{' '}
                  {pendingUploadFiles.length === 1 ? 'file' : 'files'} selected in this action
                </div>
                <ul className="space-y-1.5">
                  {pendingUploadFiles.map((file) => (
                    <li key={`pending-${file.name}-${file.size}-${file.lastModified}`} className="text-xs text-[#384039] truncate">
                      {file.name}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Identified record types (automatic) */}
          {uploadedFiles.length > 0 && !isUploading && detectedCategoryLabels.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-xl border border-[#D3DED6] bg-white px-3 py-2.5 shadow-sm"
            >
              <p className="text-xs text-[#6A6D66] leading-relaxed">
                Record types are identified automatically from file names and content — no sorting required on your end.
                {detectedCategoryLabels.length > 0 ? (
                  <>
                    {' '}
                    Identified so far: {detectedCategoryLabels.join(', ')}.
                  </>
                ) : null}
              </p>
            </motion.div>
          ) : null}

          {/* Uploaded Files with Rename */}
          {uploadedFiles.length > 0 && !isUploading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4"
            >
              <p className="text-xs text-[#6A6D66] mb-3 leading-relaxed">
                Clear file names help one3seven organize your intake more accurately and help firms review your
                records faster.
              </p>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-[#1B2623]">Files on this intake</h3>
                <div className="text-xs text-[#6A6D66]">
                  {uploadedFiles.length} {uploadedFiles.length === 1 ? 'file' : 'files'} saved
                </div>
              </div>
              {persistActionError ? (
                <p className="text-xs text-red-600 mb-2" role="alert">
                  {persistActionError}
                </p>
              ) : null}

              <div className="space-y-2">
                {visibleFileEntries.map(({ file, index }, visibleIdx) => {
                  const suggestion = titleSuggestionForFile(index, file);
                  const fileKey =
                    uploadedFilePersistMeta[index]?.uploadedFileId ?? `row-${index}-${file.size}`;
                  const showSuggestion = Boolean(suggestion) && renamingIndex !== index;

                  return (
                  <motion.div
                    key={fileKey}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: visibleIdx * 0.02 }}
                    className="py-3 border-b border-[#D3DED6] last:border-b-0"
                  >
                    <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-[#42574E] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      {renamingIndex === index ? (
                        <input
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => void saveRename(index)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void saveRename(index);
                          }}
                          className="w-full text-sm text-[#1B2623] bg-white border border-[#CBD6CF] rounded px-2 py-1 focus:border-[#5E7268] focus:outline-none focus:ring-2 focus:ring-[#D3DED6]"
                          autoFocus
                        />
                      ) : (
                        <div className="text-sm text-[#1B2623] truncate">{file.name}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(index, file.name);
                      }}
                      className="text-[#9AA39B] hover:text-[#42574E] transition-colors"
                      title="Rename"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeFile(index);
                      }}
                      className="text-[#9AA39B] hover:text-[#42574E] transition-colors"
                      title="Delete"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    </div>
                    {showSuggestion && suggestion ? (
                      <div className="mt-2.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2">
                        <p className="text-xs text-amber-950 leading-relaxed">
                          <span className="font-semibold">Suggested title:</span>{' '}
                          <span className="font-medium">{suggestion}</span>
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <button
                            type="button"
                            disabled={titleSuggestBusyIndex === index}
                            onClick={() => void acceptTitleSuggestion(index, suggestion)}
                            className="text-xs font-medium px-2.5 py-1 rounded-md bg-[#42574E] text-white hover:bg-[#374A42] disabled:opacity-50"
                          >
                            {titleSuggestBusyIndex === index ? 'Applying…' : 'Use suggestion'}
                          </button>
                          <button
                            type="button"
                            disabled={titleSuggestBusyIndex === index}
                            onClick={() => suppressSuggestionsForFile(index, file)}
                            className="text-xs font-medium px-2.5 py-1 rounded-md border border-[#D3DED6] bg-white text-[#2C332E] hover:bg-[#EEF2EE] disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </motion.div>
                  );
                })}

                {/* Expand/Collapse Button */}
                {uploadedFiles.length > 3 && (
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setShowAllFiles(!showAllFiles)}
                    className="w-full text-sm text-[#6A6D66] hover:text-[#42574E] py-2 rounded-lg hover:bg-[#EEF2EE] transition-colors"
                  >
                    {showAllFiles ? (
                      'Show Less ∧'
                    ) : (
                      `+ ${uploadedFiles.length - 3} More ${uploadedFiles.length - 3 === 1 ? 'File' : 'Files'}`
                    )}
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {workerStoryPreview ? (
            <div className="mb-4 border-b border-[#D3DED6] pb-3">
              {showStoryPreview ? (
                <>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-[11px] uppercase tracking-wide text-[#42574E]">Your story</p>
                    <button
                      type="button"
                      onClick={() => setShowStoryPreview(false)}
                      className="text-xs text-[#6A6D66] hover:text-[#42574E]"
                    >
                      {WORKER_UPLOAD_COPY.hideStory}
                    </button>
                  </div>
                  <p className="text-sm text-[#6A6D66] leading-relaxed whitespace-pre-wrap">
                    {workerStoryPreview}
                  </p>
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-[#6A6D66]">{WORKER_UPLOAD_COPY.storyProvided}</p>
                  <button
                    type="button"
                    onClick={() => setShowStoryPreview(true)}
                    className="text-xs text-[#42574E] hover:text-[#2C3A34] shrink-0"
                  >
                    {WORKER_UPLOAD_COPY.viewStory}
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {/* Optional follow-up details */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => setShowFollowUpDetails((open) => !open)}
              className="flex w-full items-center justify-between gap-2 border-b border-[#D3DED6] py-2.5 text-left hover:bg-[#EEF2EE]/70 -mx-1 px-1 rounded-sm"
            >
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[#42574E] mb-0.5">
                  {STORY_FIRST_STEP_LABELS.followUp}
                </p>
                <p className="text-sm font-medium text-[#1B2623]">{STORY_FIRST_FOLLOWUP_HEADING}</p>
              </div>
              {showFollowUpDetails ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-[#7C857F]" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-[#7C857F]" />
              )}
            </button>

            {showFollowUpDetails ? (
              <div className="mt-3 space-y-2.5">
                {/* Completeness header — unchanged logic, new card style */}
                <div className="rounded-[14px] border border-[#D3DED6] bg-[#EEF2EE]/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#1B2623]">Intake Completeness</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-[#6A6D66]">
                        These optional details help one3seven connect your story to the records you upload.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-[#42574E] ring-1 ring-[#CBD6CF]">
                      {[
                        followUp.employer,
                        followUp.employmentDates,
                        followUp.complainedOrReported,
                        followUp.changedAfterward,
                        ...(isEmploymentIntake ? [followUp.workState, followUp.employmentStatus] : []),
                      ].filter((v) => Boolean(String(v ?? '').trim())).length} of {isEmploymentIntake ? 6 : 4}
                    </span>
                  </div>
                </div>

                {/* Card: Employer */}
                <div className="rounded-[14px] border border-[#D3DED6] bg-white px-4 py-3.5 shadow-sm">
                  <label className="text-sm font-semibold text-[#1B2623]" htmlFor="followup-employer">
                    What employer or organization are these records connected to?
                  </label>
                  <input
                    id="followup-employer"
                    value={followUp.employer ?? ''}
                    onChange={(e) => updateFollowUp({ employer: e.target.value })}
                    className="mt-2.5 w-full rounded-[10px] border border-[#CBD6CF] bg-white px-3 py-2.5 text-sm text-[#1B2623] placeholder:text-[#9AA39B] focus:border-[#5E7268] focus:outline-none focus:ring-2 focus:ring-[#D3DED6]"
                    placeholder="Company or organization name"
                  />
                </div>

                {/* Card: Employment dates */}
                <div className="rounded-[14px] border border-[#D3DED6] bg-white px-4 py-3.5 shadow-sm">
                  <label className="text-sm font-semibold text-[#1B2623]" htmlFor="followup-dates">
                    Approximate employment dates?
                  </label>
                  <input
                    id="followup-dates"
                    value={followUp.employmentDates ?? ''}
                    onChange={(e) => updateFollowUp({ employmentDates: e.target.value })}
                    className="mt-2.5 w-full rounded-[10px] border border-[#CBD6CF] bg-white px-3 py-2.5 text-sm text-[#1B2623] placeholder:text-[#9AA39B] focus:border-[#5E7268] focus:outline-none focus:ring-2 focus:ring-[#D3DED6]"
                    placeholder="e.g. March 2021 – January 2024"
                  />
                </div>

                {/* Card: Complained or reported */}
                <div className="rounded-[14px] border border-[#D3DED6] bg-white px-4 py-3.5 shadow-sm">
                  <label className="text-sm font-semibold text-[#1B2623]" htmlFor="followup-complaint">
                    Did you complain, report something, or ask HR/management for help?
                  </label>
                  <textarea
                    id="followup-complaint"
                    value={followUp.complainedOrReported ?? ''}
                    onChange={(e) => updateFollowUp({ complainedOrReported: e.target.value })}
                    rows={2}
                    className="mt-2.5 w-full rounded-[10px] border border-[#CBD6CF] bg-white px-3 py-2.5 text-sm text-[#1B2623] placeholder:text-[#9AA39B] focus:border-[#5E7268] focus:outline-none focus:ring-2 focus:ring-[#D3DED6] resize-none"
                    placeholder="What you reported and when, if you remember"
                  />
                </div>

                {/* Card: Changed afterward */}
                <div className="rounded-[14px] border border-[#D3DED6] bg-white px-4 py-3.5 shadow-sm">
                  <label className="text-sm font-semibold text-[#1B2623]" htmlFor="followup-changes">
                    Did anything change afterward?
                  </label>
                  <textarea
                    id="followup-changes"
                    value={followUp.changedAfterward ?? ''}
                    onChange={(e) => updateFollowUp({ changedAfterward: e.target.value })}
                    rows={2}
                    className="mt-2.5 w-full rounded-[10px] border border-[#CBD6CF] bg-white px-3 py-2.5 text-sm text-[#1B2623] placeholder:text-[#9AA39B] focus:border-[#5E7268] focus:outline-none focus:ring-2 focus:ring-[#D3DED6] resize-none"
                    placeholder="Schedule, pay, treatment, discipline, termination, etc."
                  />
                </div>

                {/* Employment-specific cards — conditional, unchanged logic */}
                {isEmploymentIntake ? (
                  <>
                    <p className="pt-1 text-[10px] font-semibold uppercase tracking-wider text-[#5E7268]">Additional employment details</p>

                    {/* Card: Work state (determines which jurisdiction's wage rules apply) */}
                    <div className="rounded-[14px] border border-[#D3DED6] bg-white px-4 py-3.5 shadow-sm">
                      <label className="text-sm font-semibold text-[#1B2623]" htmlFor="followup-work-state">
                        In what state did you primarily work?
                      </label>
                      <p className="mt-1 text-xs leading-relaxed text-[#7C857F]">
                        The state where you did the work — this can differ from where you live.
                      </p>
                      <select
                        id="followup-work-state"
                        value={followUp.workState ?? ''}
                        onChange={(e) => updateFollowUp({ workState: e.target.value })}
                        className="mt-2.5 w-full rounded-[10px] border border-[#CBD6CF] bg-white px-3 py-2.5 text-sm text-[#1B2623] focus:border-[#5E7268] focus:outline-none focus:ring-2 focus:ring-[#D3DED6]"
                      >
                        <option value="">Select a state…</option>
                        {US_STATES.map((s) => (
                          <option key={s.code} value={s.code}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Card: Employment status */}
                    <div className="rounded-[14px] border border-[#D3DED6] bg-white px-4 py-3.5 shadow-sm">
                      <p className="text-sm font-semibold text-[#1B2623] mb-2.5">Are you currently employed there, or has employment ended?</p>
                      <div className="flex flex-wrap gap-2">
                        {EMPLOYMENT_STATUS_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => updateFollowUp({ employmentStatus: opt.value })}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                              followUp.employmentStatus === opt.value
                                ? 'border-[#42574E] bg-[#42574E] text-white'
                                : 'border-[#D3DED6] bg-white text-[#384039] hover:border-[#CBD6CF] hover:bg-[#EEF2EE]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                  </>
                ) : null}
              </div>
            ) : null}
          </div>

          {!intakeHasGeneratedSummary && onPrelinkFirmCode ? (
            <div className="mb-8 rounded-[14px] border border-[#D3DED6] bg-white p-4 shadow-sm">
              <p className="text-sm font-semibold text-[#1B2623] mb-1">Link Firm Code</p>
              <p className="text-xs text-[#6A6D66] mb-3 leading-relaxed">
                Optional: connect your law firm before organizing. This does not send your intake yet.
              </p>
              {activeIntakeLinkedFirmName ? (
                <p className="text-xs text-[#384039] mb-3">
                  Linked firm: <span className="font-semibold">{activeIntakeLinkedFirmName}</span>
                </p>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={prelinkCodeDraft}
                  onChange={(e) => setPrelinkCodeDraft(e.target.value)}
                  placeholder="Enter Firm Code"
                  disabled={prelinkBusy}
                  className="flex-1 px-4 py-3 rounded-[14px] border border-[#CBD6CF] bg-white text-sm text-[#1B2623] placeholder:text-[#7C857F] focus:border-[#5E7268] focus:outline-none focus:ring-2 focus:ring-[#D3DED6]"
                />
                <button
                  type="button"
                  onClick={() => void handlePrelinkFirmCode()}
                  disabled={prelinkBusy || !prelinkCodeDraft.trim()}
                  className={`shrink-0 rounded-[14px] px-4 py-3 text-sm font-medium disabled:opacity-50 ${UPLOAD_SECONDARY_CTA}`}
                >
                  {prelinkBusy ? 'Linking…' : 'Link firm'}
                </button>
              </div>
              {prelinkError ? <p className="mt-2 text-xs text-red-600">{prelinkError}</p> : null}
              {prelinkToast ? (
                <p className="mt-2 text-xs font-medium text-emerald-800">{prelinkToast}</p>
              ) : null}
            </div>
          ) : null}

          {docRequestFocusMode && onOpenIntakeSummary ? (
            <details className="mb-4 border-b border-[#D3DED6] group">
              <summary className="cursor-pointer list-none py-2.5 text-sm font-medium text-[#6A6D66] marker:content-none flex items-center justify-between gap-2">
                <span>{WORKER_DOC_REQUEST_PANEL_COPY.summaryCollapsedTitle}</span>
                <ChevronDown className="h-4 w-4 text-[#7C857F] group-open:rotate-180 transition-transform" />
              </summary>
              <div className="pb-3">
                <p className="text-xs text-[#40433F] leading-relaxed mb-2">
                  {WORKER_DOC_REQUEST_PANEL_COPY.summaryCollapsedHint}
                </p>
                <button
                  type="button"
                  onClick={onOpenIntakeSummary}
                  className={`w-full rounded-[14px] text-xs px-3 py-2 ${UPLOAD_SECONDARY_CTA}`}
                >
                  Open intake summary
                </button>
              </div>
            </details>
          ) : null}

          {/* CTAs with Premium Activation */}
          <div className="space-y-2 mb-4">
            {showSaveIntakeDraft && onSaveIntakeDraft ? (
              <button
                type="button"
                onClick={() => void handleSaveIntakeDraft()}
                disabled={saveDraftBusy}
                className={`w-full py-3 px-4 rounded-[14px] text-sm font-medium disabled:opacity-50 ${UPLOAD_SECONDARY_CTA}`}
              >
                {saveDraftBusy ? 'Saving draft…' : 'Save this intake draft'}
              </button>
            ) : null}
            <motion.button
              onClick={handleBeginOrganization}
              disabled={!canBeginOrganization}
              initial={{ opacity: 0.6 }}
              animate={canBeginOrganization ? {
                opacity: 1,
                boxShadow: ['0 1px 2px 0 rgb(0 0 0 / 0.05)', '0 4px 6px -1px rgb(0 0 0 / 0.1)', '0 1px 2px 0 rgb(0 0 0 / 0.05)']
              } : { opacity: 0.6 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className={`w-full py-4 px-6 rounded-[14px] transition-all font-medium ${
                canBeginOrganization
                  ? UPLOAD_PRIMARY_CTA
                  : UPLOAD_DISABLED_CTA
              }`}
            >
              {intakeHasGeneratedSummary ? 'Update Intake Summary' : 'Begin Organizing'}
            </motion.button>
            {hasMeaningfulStoryContext && uploadedFiles.length === 0 ? (
              <p className="rounded-[12px] border border-[#D3DED6] bg-white px-3 py-2 text-xs leading-relaxed text-[#40433F]">
                You can begin with your story now. Records can be added later to strengthen the timeline.
              </p>
            ) : null}
            {intakeHasGeneratedSummary ? (
              <div className="space-y-2 rounded-[14px] border border-[#D3DED6] bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#6A6D66]">
                  After organization
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('summary')}
                  className={`w-full py-3 px-4 rounded-[14px] text-sm font-medium ${UPLOAD_PRIMARY_CTA}`}
                >
                  Open summary packet
                </button>
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className={`w-full py-3 px-4 rounded-[14px] text-sm font-medium ${UPLOAD_SECONDARY_CTA}`}
                >
                  Add documents
                </button>
                <button
                  type="button"
                  onClick={handleSaveForLater}
                  className={`w-full py-3 px-4 rounded-[14px] text-sm font-medium ${UPLOAD_SECONDARY_CTA}`}
                >
                  Save for later
                </button>
                {activeIntakeLinkedFirmName ? (
                  <button
                    type="button"
                    onClick={() => onNavigate('summary')}
                    className={`w-full py-3 px-4 rounded-[14px] text-sm font-medium ${UPLOAD_SECONDARY_CTA}`}
                  >
                    Review sharing options
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Privacy & reassurance — low priority footer */}
          <div className="mt-6 pt-4 border-t border-[#D3DED6] space-y-2">
            <p className="text-[10px] text-[#6A6D66] leading-relaxed">{UPLOAD_CONSENT_NOTICE}</p>
            <p className="text-[10px] text-[#6A6D66] leading-relaxed">
              Uploaded records are organized to support intake preparation workflows.
            </p>
            <p className="text-[10px] text-[#6A6D66] leading-relaxed">
              Shared materials remain connected to your intake workspace unless exported or submitted by you.
            </p>
            <One3SevenDisclaimer
              variant="compact"
              summaryClassName="text-[10px] text-[#6A6D66]"
              bodyClassName="text-[10px] leading-relaxed text-[#6A6D66]"
            />
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showFirmGateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-[#1B2623]/25 px-4 py-8 backdrop-blur-sm"
            onClick={() => {
              if (!firmGateBusy) {
                setShowFirmGateModal(false);
                setFirmGateStep('intro');
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="w-full max-w-md rounded-[20px] bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-[#1B2623] mb-2">Are you working with a law firm?</h2>
              <p className="text-sm text-[#6A6D66] leading-relaxed mb-4">
                If your law firm gave you a one3seven Firm Code, you can enter it now so your organized intake routes directly to their dashboard after processing.
              </p>
              <p className="text-xs text-[#40433F] mb-4">
                Firm Code is the official routing code assigned to a participating law firm—not a random invite code.
              </p>
              {firmGateStep === 'intro' ? (
                <div className="space-y-2 mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFirmGateStep('code');
                      setFirmGateError('');
                      setLinkedFirmPreview(null);
                      setFirmCodeDraft('');
                    }}
                    disabled={firmGateBusy}
                    className={`w-full py-3 rounded-[14px] text-sm font-medium disabled:opacity-50 ${UPLOAD_PRIMARY_CTA}`}
                  >
                    Enter Firm Code
                  </button>
                  <button
                    type="button"
                    onClick={handleFirmGateContinueWithout}
                    disabled={firmGateBusy}
                    className={`w-full py-3 rounded-[14px] text-sm font-medium ${UPLOAD_SECONDARY_CTA}`}
                  >
                    Continue Without Firm Code
                  </button>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setFirmGateStep('intro');
                      setFirmGateError('');
                      setLinkedFirmPreview(null);
                      setFirmCodeDraft('');
                    }}
                    disabled={firmGateBusy}
                    className="mb-3 text-xs text-[#7C857F] hover:text-[#1B2623]"
                  >
                    ← Back
                  </button>
                  <div className="space-y-2 mb-4">
                    <input
                      value={firmCodeDraft}
                      onChange={(e) => setFirmCodeDraft(e.target.value)}
                      placeholder="Enter Firm Code"
                      className="w-full px-4 py-3 rounded-[14px] border border-[#CBD6CF] bg-[#EEF2EE]/50 text-sm text-[#1B2623] placeholder:text-[#7C857F] focus:border-[#5E7268] focus:outline-none focus:ring-2 focus:ring-[#D3DED6]"
                      disabled={firmGateBusy}
                    />
                    <button
                      type="button"
                      onClick={() => void handleFirmGateLookup()}
                      disabled={firmGateBusy || !firmCodeDraft.trim()}
                      className={`w-full py-3 rounded-[14px] text-sm font-medium disabled:opacity-50 ${UPLOAD_SECONDARY_CTA}`}
                    >
                      Validate firm code
                    </button>
                  </div>
                  {linkedFirmPreview ? (
                    <p className="text-sm text-[#1B2623] mb-3">
                      Connected to <span className="font-semibold">{linkedFirmPreview.firm_name}</span>. Your organized intake will be routed only to this firm.
                    </p>
                  ) : null}
                  {firmGateError ? <p className="text-sm text-red-600 mb-3">{firmGateError}</p> : null}
                  <div className="space-y-2">
                    {linkedFirmPreview ? (
                      <button
                        type="button"
                        onClick={() => void handleFirmGateConfirmLinked()}
                        disabled={firmGateBusy}
                        className={`w-full py-3 rounded-[14px] text-sm font-medium disabled:opacity-50 ${UPLOAD_PRIMARY_CTA}`}
                      >
                        Begin Organizing
                      </button>
                    ) : null}
                  </div>
                </>
              )}
              <div className="space-y-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!firmGateBusy) {
                      setShowFirmGateModal(false);
                      setFirmGateStep('intro');
                    }
                  }}
                  className="w-full py-2 text-sm text-[#7C857F]"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
