/**
 * File-upload/storage domain: draft-intake creation, uploading a file to storage + its
 * uploaded_files row, listing/renaming/deleting uploaded files, and reading extraction
 * status/coverage facts for a file set. Extracted 2026-08-21 from intakeDataService.ts (PR4,
 * seam 3). Pure move, no behavior change.
 *
 * intakeDataService.ts imports 4 names back from here (listUploadedFiles,
 * listUploadedFilesResult, listCompletedExtractionsForIntake, CompletedFileExtractionRow) --
 * the overview-parsing/organization-persistence logic that stays there reads the file list and
 * completed-extraction rows while assembling a summary. Real, acknowledged two-way dependency,
 * same pattern as seam 1.
 */
import { supabase } from '../lib/supabaseClient';
import { safeTrim } from './summarySaveDiagnostics';
import {
  isSchemaRelationUnavailable,
  inferCategoryFromFileName,
  resolveCategoryAfterFileRename,
  generateIntakeNumber,
  sanitizeFirmFacingText,
  persistPlaceholderOrganizationForIntake,
  FIRM_DOCUMENT_REQUEST_PATTERN,
  WORKER_DOCUMENT_RESPONSE_PATTERN,
} from './intakeDataService';

export async function createDraftIntake(
  workerId: string,
  opts?: {
    linked_firm_id?: string | null;
    submission_channel?: 'firm_code' | null;
    /** When set, used instead of the default O3S-* generated number. */
    intake_number?: string | null;
  }
): Promise<{ id?: string; intake_number?: string; error?: string }> {
  const custom = opts?.intake_number?.trim();
  const intake_number = custom || generateIntakeNumber();
  const insert: Record<string, unknown> = {
    worker_id: workerId,
    intake_number,
    status: 'draft',
    workflow_status: 'Upload Complete',
  };
  if (opts?.linked_firm_id) {
    insert.linked_firm_id = opts.linked_firm_id;
    insert.submission_channel = opts.submission_channel ?? 'firm_code';
  }
  let { data, error } = await supabase.from('intakes').insert(insert).select('id, intake_number').single();
  // Safety net: if the chosen intake_number collides (e.g. a stale display sequence), retry
  // once with a uniquified number rather than hard-failing the worker mid-intake.
  if (error && (error as { code?: string }).code === '23505') {
    insert.intake_number = `${intake_number}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    ({ data, error } = await supabase.from('intakes').insert(insert).select('id, intake_number').single());
  }
  if (error) return { error: error.message };
  return { id: data.id, intake_number: data.intake_number };
}

export async function uploadIntakeFile(
  workerId: string,
  intakeId: string,
  file: File
): Promise<{
  error?: string;
  path?: string;
  uploadedFileId?: string;
  duplicate?: boolean;
  contentHash?: string;
}> {
  console.info('[o3s-upload] upload start', {
    workerId,
    intakeId,
    fileName: file.name,
    fileSize: file.size,
  });

  const { computeFileContentHash, buildFileFingerprint } = await import('./fileUploadIntegrity');
  let contentHash: string;
  try {
    contentHash = await computeFileContentHash(file);
  } catch (hashErr) {
    console.warn('[o3s-upload] content hash failed', { fileName: file.name, hashErr });
    return { error: 'Could not fingerprint this file for upload. Try again.' };
  }
  const fingerprint = buildFileFingerprint(file.name, file.size, contentHash);
  console.info('[o3s-upload] record fingerprint', { fileName: file.name, fingerprint });

  const { data: existingRows, error: existingErr } = await supabase
    .from('uploaded_files')
    .select('id, file_path, file_name, file_size, content_hash')
    .eq('intake_id', intakeId)
    .eq('content_hash', contentHash)
    .limit(1);
  if (existingErr && !existingErr.message.includes('content_hash')) {
    console.warn('[o3s-upload] duplicate lookup failed', { message: existingErr.message });
    return { error: existingErr.message };
  }
  const existing = existingRows?.[0];
  if (existing?.id && existing.file_path) {
    console.info('[o3s-upload] record duplication detected', {
      fileName: file.name,
      existingUploadedFileId: existing.id,
      existingPath: existing.file_path,
      fingerprint,
    });
    return {
      path: String(existing.file_path),
      uploadedFileId: String(existing.id),
      duplicate: true,
      contentHash,
    };
  }

  const safe = `${Date.now()}_${file.name.replace(/[^\w.\-]/g, '_')}`;
  const path = `${workerId}/${intakeId}/${safe}`;
  console.info('[o3s-upload] storage upload (before)', {
    workerId,
    intakeId,
    fileName: file.name,
    path,
    contentHash,
  });
  const { error: upErr } = await supabase.storage.from('intake-files').upload(path, file, { upsert: false });
  if (upErr) {
    console.warn('[o3s-upload] upload failure (storage)', { fileName: file.name, message: upErr.message });
    return { error: upErr.message, contentHash };
  }
  console.info('[o3s-upload] storage upload succeeded', { path, contentHash });

  const category = inferCategoryFromFileName(file.name);
  const insertPayload: Record<string, unknown> = {
    intake_id: intakeId,
    worker_id: workerId,
    file_name: file.name,
    file_path: path,
    file_type: file.type || null,
    file_size: file.size,
    category,
    content_hash: contentHash,
  };
  console.info('[o3s-upload] record creation (before)', {
    fileName: file.name,
    path,
    contentHash,
  });
  const { data: inserted, error: dbErr } = await supabase
    .from('uploaded_files')
    .insert(insertPayload)
    .select('id')
    .single();
  let dbInsertError = dbErr;
  let insertedRow = inserted;
  if (dbInsertError?.message.includes('content_hash')) {
    console.warn('[o3s-upload] content_hash column unavailable; inserting without hash dedupe');
    delete insertPayload.content_hash;
    const retry = await supabase.from('uploaded_files').insert(insertPayload).select('id').single();
    dbInsertError = retry.error;
    insertedRow = retry.data;
  }
  if (dbInsertError) {
    console.warn('[o3s-upload] upload failure (record creation)', {
      fileName: file.name,
      message: dbInsertError.message,
    });
    const { error: rollbackErr } = await supabase.storage.from('intake-files').remove([path]);
    if (rollbackErr) {
      console.error('[o3s-upload] storage rollback failed after record insert error', {
        path,
        message: rollbackErr.message,
      });
    } else {
      console.info('[o3s-upload] storage rollback succeeded after record insert error', { path });
    }
    if (dbInsertError.code === '23505') {
      const { data: raced } = await supabase
        .from('uploaded_files')
        .select('id, file_path')
        .eq('intake_id', intakeId)
        .eq('content_hash', contentHash)
        .maybeSingle();
      if (raced?.id && raced.file_path) {
        console.info('[o3s-upload] record duplication detected (insert race)', {
          fileName: file.name,
          existingUploadedFileId: raced.id,
          fingerprint,
        });
        return {
          path: String(raced.file_path),
          uploadedFileId: String(raced.id),
          duplicate: true,
          contentHash,
        };
      }
    }
    return { error: dbInsertError.message, contentHash };
  }
  const uploadedFileId = insertedRow?.id as string;
  console.info('[o3s-upload] upload success', {
    fileName: file.name,
    uploadedFileId: uploadedFileId ?? null,
    path,
    contentHash,
  });
  console.info('[o3s-upload] record creation succeeded', { uploadedFileId: uploadedFileId ?? null, path });
  if (uploadedFileId) {
    // Fire-and-forget so the upload returns fast. runPhase2AFileTextExtraction records its own
    // failures in-band (extraction_status='failed' via its outer catch), so a normal extraction
    // error is NOT silent â€” it is persisted per file. This catch only fires if the dynamic import
    // itself fails; log with enough context to trace which file/intake was affected.
    void import('./fileTextExtractionService')
      .then(({ runPhase2AFileTextExtraction }) =>
        runPhase2AFileTextExtraction({
          uploadedFileId,
          intakeId,
          workerId,
          fileName: file.name,
          fileType: file.type || null,
          filePath: path,
          fileSizeBytes: file.size,
        })
      )
      .catch((e) =>
        console.error('[o3s-upload] Phase 2A extraction failed to start', {
          uploadedFileId,
          intakeId,
          fileName: file.name,
          error: e instanceof Error ? e.message : String(e),
        })
      );
  }
  return { path, uploadedFileId, contentHash };
}

async function queryUploadedFiles(intakeId: string) {
  const { data, error } = await supabase
    .from('uploaded_files')
    .select('id, file_name, file_type, file_path, category, file_size, created_at')
    .eq('intake_id', intakeId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error(error);
    return { rows: [] as NonNullable<typeof data>, error: error.message };
  }
  return { rows: data ?? [], error: undefined as string | undefined };
}

export async function listUploadedFiles(intakeId: string) {
  const { rows } = await queryUploadedFiles(intakeId);
  return rows;
}

/**
 * Same query as listUploadedFiles, but distinguishes "zero files" from "the read failed" --
 * listUploadedFiles collapses both to an empty array, which is fine for callers that only care
 * about a count/best-effort loop, but is exactly the bug behind H2 (worker audit, 2026-08) when a
 * caller hard-replaces visible UI state with the result: a transient read error made a worker's
 * entire file list appear to vanish, even though nothing was actually deleted server-side.
 */
export async function listUploadedFilesResult(intakeId: string) {
  return queryUploadedFiles(intakeId);
}

export async function updateUploadedFileName(
  uploadedFileId: string,
  fileName: string
): Promise<{ error?: string; category?: string }> {
  const nextName = fileName.trim();
  if (!nextName) return { error: 'File name cannot be empty.' };

  const { data: existing, error: readErr } = await supabase
    .from('uploaded_files')
    .select('category')
    .eq('id', uploadedFileId)
    .maybeSingle();
  if (readErr) return { error: readErr.message };

  const category = resolveCategoryAfterFileRename(
    (existing?.category as string | null) ?? null,
    nextName
  );

  const { error } = await supabase
    .from('uploaded_files')
    .update({
      file_name: nextName,
      category,
    })
    .eq('id', uploadedFileId);

  return error ? { error: error.message } : { category };
}

/** Rebuild summary/timeline/readiness when labels change after organization already ran. */
export async function refreshDerivedIntakeLabelsAfterFileRename(
  intakeId: string
): Promise<{ error?: string }> {
  const id = intakeId.trim();
  if (!id) return {};
  const { data: summary, error } = await supabase
    .from('intake_summaries')
    .select('id')
    .eq('intake_id', id)
    .limit(1)
    .maybeSingle();
  if (error && !isSchemaRelationUnavailable(error)) return { error: error.message };
  if (!summary) return {};
  return persistPlaceholderOrganizationForIntake(id);
}

export async function deleteUploadedFileAndStorage(
  uploadedFileId: string,
  filePath: string
): Promise<{ error?: string }> {
  const path = filePath.trim();
  if (!path) return { error: 'Missing storage path for uploaded file.' };

  const { data: removed, error: storageError } = await supabase.storage.from('intake-files').remove([path]);
  if (storageError) return { error: storageError.message };
  // Verify the blob is actually gone before deleting its DB row. If we can't confirm removal,
  // keep the row (the pointer) so the file is never orphaned/invisible â€” and report honestly.
  const confirmed = (removed ?? []).some((o) => (o?.name ?? '').trim() === path);
  if (!confirmed) {
    console.error('[o3s-delete-file] storage removal not confirmed', { uploadedFileId, path });
    return { error: 'We could not confirm this file was removed from storage. Please try again, or contact support.' };
  }

  const { error: rowError } = await supabase.from('uploaded_files').delete().eq('id', uploadedFileId);
  return rowError ? { error: rowError.message } : {};
}

/** When the DB has no timeline rows yet but files exist, insert one card per upload (no schema change). */
export type CompletedFileExtractionRow = {
  uploaded_file_id: string;
  intake_id: string;
  worker_id: string;
  extracted_text: string;
  extraction_status: string;
  quality_flags: Record<string, unknown> | null;
  document_facts: Record<string, unknown> | null;
  uploaded_files: {
    id: string;
    file_name: string;
    category: string | null;
  } | null;
};

export async function listCompletedExtractionsForIntake(
  intakeId: string
): Promise<{ rows: CompletedFileExtractionRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('file_text_extractions')
    .select(
      'uploaded_file_id, intake_id, worker_id, extracted_text, extraction_status, quality_flags, document_facts, uploaded_files!inner(id, file_name, category)'
    )
    .eq('intake_id', intakeId)
    .eq('extraction_status', 'completed');

  if (error) {
    if (isSchemaRelationUnavailable(error)) return { rows: [] };
    return { rows: [], error: error.message };
  }

  const rows = (data ?? [])
    .map((row: any) => {
      const file = Array.isArray(row.uploaded_files) ? row.uploaded_files[0] : row.uploaded_files;
      return {
        uploaded_file_id: String(row.uploaded_file_id ?? file?.id ?? ''),
        intake_id: String(row.intake_id ?? intakeId),
        worker_id: String(row.worker_id ?? ''),
        extracted_text: String(row.extracted_text ?? ''),
        extraction_status: String(row.extraction_status ?? ''),
        quality_flags: (row.quality_flags ?? null) as Record<string, unknown> | null,
        document_facts: (row.document_facts ?? null) as Record<string, unknown> | null,
        uploaded_files: file
          ? {
              id: String(file.id ?? row.uploaded_file_id ?? ''),
              file_name: String(file.file_name ?? 'Uploaded file'),
              category: (file.category as string | null) ?? null,
            }
          : null,
      } satisfies CompletedFileExtractionRow;
    })
    .filter((row: CompletedFileExtractionRow) => row.uploaded_file_id && safeTrim(row.extracted_text, 'file_text_extractions.extracted_text').length > 0);

  return { rows };
}

/** Per-file facts + text snippet for the CA record-coverage rail (content-based presence signals). */
export type CoverageExtractionFactsRow = {
  fileName: string;
  documentFacts: Record<string, unknown> | null;
  textSnippet: string;
};

/**
 * Facts + head-of-text snippets for coverage assessment. Unlike
 * `listCompletedExtractionsForIntake`, rows with an EMPTY text layer are kept â€” a scanned
 * employment agreement or personnel-file production often has no text but rich stored facts,
 * and those facts are exactly what the coverage rail's content signals need.
 */
export async function listExtractionFactsForCoverage(
  intakeId: string
): Promise<{ rows: CoverageExtractionFactsRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('file_text_extractions')
    .select('extracted_text, document_facts, uploaded_files!inner(file_name)')
    .eq('intake_id', intakeId)
    .eq('extraction_status', 'completed');

  if (error) {
    if (isSchemaRelationUnavailable(error)) return { rows: [] };
    return { rows: [], error: error.message };
  }

  const rows = (data ?? [])
    .map((row: any) => {
      const file = Array.isArray(row.uploaded_files) ? row.uploaded_files[0] : row.uploaded_files;
      return {
        fileName: String(file?.file_name ?? ''),
        documentFacts: (row.document_facts ?? null) as Record<string, unknown> | null,
        textSnippet: String(row.extracted_text ?? '').slice(0, 2000),
      } satisfies CoverageExtractionFactsRow;
    })
    .filter((row: CoverageExtractionFactsRow) => row.fileName.length > 0);

  return { rows };
}

export async function getExtractionStatusForIntake(intakeId: string): Promise<{
  total: number;
  completed: number;
  pending: number;
  processing: number;
  failed: number;
  missing: number;
  error?: string;
}> {
  const files = await listUploadedFiles(intakeId);
  if (!files.length) {
    return { total: 0, completed: 0, pending: 0, processing: 0, failed: 0, missing: 0 };
  }

  const { data, error } = await supabase
    .from('file_text_extractions')
    .select('uploaded_file_id, extraction_status')
    .eq('intake_id', intakeId);

  if (error) {
    if (isSchemaRelationUnavailable(error)) {
      return { total: files.length, completed: 0, pending: 0, processing: 0, failed: 0, missing: files.length };
    }
    return { total: files.length, completed: 0, pending: 0, processing: 0, failed: 0, missing: files.length, error: error.message };
  }

  const statusByFile = new Map<string, string>();
  for (const row of data ?? []) {
    statusByFile.set(String((row as any).uploaded_file_id), String((row as any).extraction_status ?? ''));
  }

  let completed = 0;
  let pending = 0;
  let processing = 0;
  let failed = 0;
  let missing = 0;
  for (const file of files) {
    const status = statusByFile.get(String(file.id));
    if (status === 'completed') completed += 1;
    else if (status === 'pending') pending += 1;
    else if (status === 'processing') processing += 1;
    else if (status === 'failed') failed += 1;
    else missing += 1;
  }

  return { total: files.length, completed, pending, processing, failed, missing };
}
export async function ensureTimelineEventsFromUploadedFiles(intakeId: string): Promise<{ error?: string }> {
  const files = await listUploadedFiles(intakeId);
  if (!files.length) return {};
  const { data: existing, error: exErr } = await supabase
    .from('timeline_events')
    .select('id')
    .eq('intake_id', intakeId)
    .limit(1);
  if (exErr && !isSchemaRelationUnavailable(exErr)) return { error: exErr.message };
  if (existing && existing.length > 0) return {};

  const { data: summaryRow, error: summaryErr } = await supabase
    .from('intake_summaries')
    .select('id')
    .eq('intake_id', intakeId)
    .limit(1)
    .maybeSingle();
  if (summaryErr && !isSchemaRelationUnavailable(summaryErr)) return { error: summaryErr.message };

  if (!summaryRow) {
    // Organization has not persisted yet; avoid timeline rows without O3S_ORG_ENGINE.
    return {};
  }

  return persistPlaceholderOrganizationForIntake(intakeId);
}

