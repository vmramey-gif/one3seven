import { describe, expect, it } from 'vitest';

type WorkerDocumentResponseDraft = {
  fulfilled: string[];
  note: string;
};

type WorkerIntakeMetadata = {
  employmentMatterTags?: string[];
  documentResponseDraft?: WorkerDocumentResponseDraft | null;
};

function parseWorkerIntakeMetadata(raw: unknown): WorkerIntakeMetadata {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const row = raw as Record<string, unknown>;
  const draftRaw = row.documentResponseDraft;
  let documentResponseDraft: WorkerDocumentResponseDraft | undefined;
  if (draftRaw && typeof draftRaw === 'object' && !Array.isArray(draftRaw)) {
    const draft = draftRaw as Record<string, unknown>;
    const fulfilled = Array.isArray(draft.fulfilled)
      ? draft.fulfilled.map((item) => String(item).trim()).filter(Boolean)
      : [];
    const note = typeof draft.note === 'string' ? draft.note : '';
    if (fulfilled.length || note.trim()) {
      documentResponseDraft = { fulfilled, note };
    }
  }
  return {
    employmentMatterTags: Array.isArray(row.employmentMatterTags)
      ? (row.employmentMatterTags as string[])
      : undefined,
    documentResponseDraft,
  };
}

describe('workerIntakeMetadata parsing', () => {
  it('restores document response draft and employment matter tags', () => {
    const parsed = parseWorkerIntakeMetadata({
      employmentMatterTags: ['wage_hour'],
      documentResponseDraft: {
        fulfilled: ['Pay records / paystubs'],
        note: 'Attached latest stubs',
      },
    });
    expect(parsed.employmentMatterTags).toEqual(['wage_hour']);
    expect(parsed.documentResponseDraft?.fulfilled).toEqual(['Pay records / paystubs']);
    expect(parsed.documentResponseDraft?.note).toBe('Attached latest stubs');
  });
});
