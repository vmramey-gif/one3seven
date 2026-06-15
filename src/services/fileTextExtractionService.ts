/**
 * Phase 2A: download stored bytes, extract plain text, persist file_text_extractions.
 * No OCR, no LLM, no legal analysis.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { supabase } from '../lib/supabaseClient';

function isSchemaRelationUnavailable(err: { message?: string; code?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = (err.message ?? '').toLowerCase();
  const code = String(err.code ?? '');
  if (code === 'PGRST205' || code === '42P01') return true;
  if (msg.includes('schema cache') || msg.includes('could not find the table')) return true;
  if (msg.includes('does not exist') && (msg.includes('relation') || msg.includes('table'))) return true;
  return false;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

const BUCKET = 'intake-files';
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACT_CHARS = 500_000;

export type Phase2AExtractionParams = {
  uploadedFileId: string;
  intakeId: string;
  workerId: string;
  fileName: string;
  fileType: string | null;
  filePath: string;
  fileSizeBytes: number;
};

function extOf(fileName: string): string {
  const m = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : '';
}

export function isPhase2ASupportedUpload(fileName: string, fileType: string | null): boolean {
  const ext = extOf(fileName);
  const mime = (fileType ?? '').toLowerCase();
  if (ext === 'txt' || mime === 'text/plain') return true;
  if (ext === 'html' || ext === 'htm' || mime === 'text/html') return true;
  if (ext === 'json' || mime === 'application/json' || mime.endsWith('+json')) return true;
  if (ext === 'pdf' || mime === 'application/pdf') return true;
  return false;
}

function truncateText(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_EXTRACT_CHARS) return { text, truncated: false };
  return { text: text.slice(0, MAX_EXTRACT_CHARS), truncated: true };
}

function bytesToUtf8String(bytes: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function extractHtmlVisibleText(bytes: ArrayBuffer): string {
  const raw = bytesToUtf8String(bytes);
  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const text = (doc.body?.innerText ?? '').replace(/\r\n/g, '\n');
  return text.trim();
}

function extractJsonText(bytes: ArrayBuffer): string {
  const raw = bytesToUtf8String(bytes).trim();
  const parsed = JSON.parse(raw);
  return JSON.stringify(parsed, null, 2);
}

async function extractPdfTextLayer(bytes: ArrayBuffer): Promise<string> {
  const data = new Uint8Array(bytes);
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => {
        if (item && typeof item === 'object' && 'str' in item && typeof (item as { str: string }).str === 'string') {
          return (item as { str: string }).str;
        }
        return '';
      })
      .join(' ');
    parts.push(line);
  }
  return parts.join('\n').replace(/\s+\n/g, '\n').trim();
}

async function setExtractionFields(
  uploadedFileId: string,
  fields: Record<string, unknown>
): Promise<{ error?: unknown }> {
  const { error } = await supabase.from('file_text_extractions').update(fields).eq('uploaded_file_id', uploadedFileId);
  return { error };
}

export async function runPhase2AFileTextExtraction(params: Phase2AExtractionParams): Promise<void> {
  const { uploadedFileId, intakeId, workerId, fileName, fileType, filePath, fileSizeBytes } = params;

  if (!isPhase2ASupportedUpload(fileName, fileType)) {
    return;
  }

  if (fileSizeBytes > MAX_DOWNLOAD_BYTES) {
    const { error: insErr } = await supabase.from('file_text_extractions').upsert(
      {
        uploaded_file_id: uploadedFileId,
        intake_id: intakeId,
        worker_id: workerId,
        extraction_status: 'failed',
        extraction_method: null,
        extracted_text: null,
        error_message: 'File exceeds Phase 2A download limit (' + MAX_DOWNLOAD_BYTES + ' bytes).',
        quality_flags: { skipped_reason: 'file_too_large' },
      },
      { onConflict: 'uploaded_file_id' }
    );
    if (insErr && !isSchemaRelationUnavailable(insErr)) console.error('file_text_extractions insert', insErr);
    return;
  }

  const { error: pendingErr } = await supabase.from('file_text_extractions').upsert(
    {
      uploaded_file_id: uploadedFileId,
      intake_id: intakeId,
      worker_id: workerId,
      extraction_status: 'pending',
      extraction_method: null,
      extracted_text: null,
      error_message: null,
      quality_flags: {},
    },
    { onConflict: 'uploaded_file_id' }
  );
  if (pendingErr) {
    if (isSchemaRelationUnavailable(pendingErr)) return;
    console.error('file_text_extractions pending', pendingErr);
    return;
  }

  const { error: procErr } = await setExtractionFields(uploadedFileId, {
    extraction_status: 'processing',
    error_message: null,
  });
  if (procErr) {
    if (isSchemaRelationUnavailable(procErr)) return;
    console.error('file_text_extractions processing', procErr);
    return;
  }

  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(filePath);
  if (dlErr || !blob) {
    await setExtractionFields(uploadedFileId, {
      extraction_status: 'failed',
      extraction_method: null,
      extracted_text: null,
      error_message: dlErr?.message ?? 'Storage download failed.',
      quality_flags: { download: false },
    });
    return;
  }

  if (blob.size > MAX_DOWNLOAD_BYTES) {
    await setExtractionFields(uploadedFileId, {
      extraction_status: 'failed',
      extraction_method: null,
      extracted_text: null,
      error_message: 'Downloaded object exceeds Phase 2A limit (' + MAX_DOWNLOAD_BYTES + ' bytes).',
      quality_flags: { skipped_reason: 'download_too_large' },
    });
    return;
  }

  const bytes = await blob.arrayBuffer();
  const ext = extOf(fileName);
  const mime = (fileType ?? '').toLowerCase();

  const fail = async (message: string, method: string | null, flags: Record<string, unknown> = {}) => {
    await setExtractionFields(uploadedFileId, {
      extraction_status: 'failed',
      extraction_method: method,
      extracted_text: null,
      error_message: message,
      quality_flags: flags,
    });
  };

  try {
    let method: string;
    let rawText: string;

    if (ext === 'txt' || mime === 'text/plain') {
      method = 'text_utf8';
      rawText = bytesToUtf8String(bytes).replace(/\r\n/g, '\n').trim();
    } else if (ext === 'html' || ext === 'htm' || mime === 'text/html') {
      method = 'html_visible_text';
      rawText = extractHtmlVisibleText(bytes);
    } else if (ext === 'json' || mime === 'application/json' || mime.endsWith('+json')) {
      method = 'json_normalized';
      rawText = extractJsonText(bytes);
    } else if (ext === 'pdf' || mime === 'application/pdf') {
      method = 'pdf_text_layer';
      rawText = await extractPdfTextLayer(bytes);
      if (!rawText.trim()) {
        await fail(
          'No text layer found; scanned PDFs are not supported in Phase 2A.',
          method,
          { empty_text_layer: true }
        );
        return;
      }
    } else {
      return;
    }

    const { text: finalText, truncated } = truncateText(rawText);
    const { error: doneErr } = await setExtractionFields(uploadedFileId, {
      extraction_status: 'completed',
      extraction_method: method,
      extracted_text: finalText,
      error_message: null,
      quality_flags: truncated ? { truncated: true } : {},
    });
    if (doneErr && !isSchemaRelationUnavailable(doneErr)) console.error('file_text_extractions completed', doneErr);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await fail(msg, null, { exception: true });
  }
}