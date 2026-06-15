import {
  extractFirmDocumentRequestFromOverview,
  type FirmDocumentRequestPayload,
} from '../../services/intakeDataService';
import {
  WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED,
  WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS,
} from '../constants/one3sevenProduct';

export type WorkerDocumentRequestView = {
  categories: string[];
  note: string;
  firmName: string | null;
};

export type WorkerDocumentRequestStatus = 'pending' | 'uploaded' | 'submitted';

export type WorkerDocumentRequestPayloadState = {
  requested_categories: string[];
  firm_note: string;
  firm_name: string;
};

export function resolveWorkerFirmDocumentRequest(
  overview: string | undefined,
  missing: string[] | undefined
): FirmDocumentRequestPayload | null {
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

export function buildWorkerDocumentRequestView(
  documentRequestPayload: WorkerDocumentRequestPayloadState | null | undefined,
  liveOverview: string | undefined,
  liveMissing: string[] | undefined,
  linkedFirmName: string | null | undefined
): WorkerDocumentRequestView | null {
  const fromPayload = documentRequestPayload
    ? {
        categories: (documentRequestPayload.requested_categories ?? [])
          .map((c) => c.trim())
          .filter(Boolean),
        note: (documentRequestPayload.firm_note ?? '').trim(),
        firmName:
          (documentRequestPayload.firm_name ?? '').trim() ||
          (linkedFirmName ?? '').trim() ||
          null,
      }
    : null;

  if (fromPayload && (fromPayload.categories.length > 0 || fromPayload.note)) {
    return fromPayload;
  }

  const fromSummary = resolveWorkerFirmDocumentRequest(liveOverview, liveMissing);
  if (!fromSummary) return null;

  return {
    categories: fromSummary.categories,
    note: fromSummary.note,
    firmName: (linkedFirmName ?? '').trim() || null,
  };
}

export function getWorkerDocumentRequestStatus(
  workflow: string | null | undefined
): WorkerDocumentRequestStatus | null {
  const w = (workflow ?? '').trim();
  if (w === WORKFLOW_ADDITIONAL_DOCUMENTS_REQUESTED) return 'pending';
  if (w === 'Worker Uploaded Additional Documents') return 'uploaded';
  if (w === WORKFLOW_WORKER_UPLOADED_REQUESTED_DOCUMENTS) return 'submitted';
  return null;
}

export function workerDocumentRequestNeedsAction(
  workflow: string | null | undefined,
  view: WorkerDocumentRequestView | null
): boolean {
  const status = getWorkerDocumentRequestStatus(workflow);
  if (status === 'pending') return true;
  if (status === 'uploaded') return true;
  return Boolean(view && (view.categories.length > 0 || view.note) && status === 'pending');
}

export function buildWorkerDocumentRequestPayloadFromSummary(
  overview: string | undefined,
  missing: string[] | undefined,
  firmName: string | null | undefined
): WorkerDocumentRequestPayloadState | null {
  const req = resolveWorkerFirmDocumentRequest(overview, missing);
  if (!req || (!req.categories.length && !req.note)) return null;
  return {
    requested_categories: req.categories,
    firm_note: req.note,
    firm_name: (firmName ?? '').trim(),
  };
}

export function formatDocumentRequestDateLabel(updatedAt: string | null | undefined): string | null {
  const raw = (updatedAt ?? '').trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
