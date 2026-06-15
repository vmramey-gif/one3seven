/** Structured console diagnostics for intake summary persistence (P0 debugging). */
export function logSummarySave(stage: string, detail: Record<string, unknown> = {}): void {
  console.info(`[o3s-summary-save] ${stage}`, detail);
}

export function logSummarySaveError(
  stage: string,
  error: unknown,
  detail: Record<string, unknown> = {}
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error('[o3s-summary-save] error details', {
    stage,
    message: err.message,
    name: err.name,
    stack: err.stack,
    ...detail,
  });
}

/** Temporary: log when a non-string value is trimmed during organization/save. */
export function logTrimGuard(fieldName: string, value: unknown, fallbackUsed: boolean): void {
  if (!fallbackUsed) return;
  console.warn('[o3s-summary-save] trim guard', {
    fieldName,
    incomingType: value === null ? 'null' : value === undefined ? 'undefined' : typeof value,
    fallbackUsed: true,
  });
}

/** Temporary: log before trimming on the organization assembly path. */
export function logTrimCandidate(
  value: unknown,
  meta: { file: string; line: number; variable: string }
): void {
  console.info('[o3s-summary-save] trim candidate', {
    file: meta.file,
    line: meta.line,
    variable: meta.variable,
    typeof: value === null ? 'null' : typeof value,
    valueIsUndefined: value === undefined,
  });
}

/** Safe trim with assembly-path trim candidate logging. */
export function trimAssemblyValue(
  value: unknown,
  meta: { file: string; line: number; variable: string }
): string {
  logTrimCandidate(value, meta);
  return safeTrimInternal(value, `${meta.file}:${meta.variable}`);
}

/** Safe trim for organization pipeline — never throws on null/undefined. */
export function safeTrim(value: unknown, fieldName: string): string {
  logTrimCandidate(value, {
    file: 'summarySaveDiagnostics.ts',
    line: 55,
    variable: fieldName,
  });
  return safeTrimInternal(value, fieldName);
}

function safeTrimInternal(value: unknown, fieldName: string): string {
  if (typeof value === 'string') return value.trim();
  const fallbackUsed = value == null || typeof value !== 'string';
  logTrimGuard(fieldName, value, fallbackUsed);
  return typeof value === 'number' || typeof value === 'boolean' ? String(value).trim() : '';
}

/** Temporary: log a safe preview of generated summary text (not full payload). */
export function logGeneratedSummaryPreview(
  intakeId: string,
  fields: {
    overview?: string;
    timelineSummary?: string;
    readinessCount?: number;
    missingCount?: number;
    timelineEventCount?: number;
  }
): void {
  const preview = (text: string | undefined, max = 320) => {
    const t = (text ?? '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.length <= max ? t : `${t.slice(0, max)}…`;
  };
  logSummarySave('generated summary preview', {
    intakeId,
    overviewPreview: preview(fields.overview),
    timelineSummaryPreview: preview(fields.timelineSummary, 200),
    readinessIndicatorCount: fields.readinessCount ?? 0,
    missingAlertCount: fields.missingCount ?? 0,
    timelineEventCount: fields.timelineEventCount ?? 0,
  });
}

/** Temporary: log Supabase write outcome with optional payload size context. */
export function logSupabaseWriteResult(
  table: string,
  operation: 'insert' | 'update' | 'delete',
  detail: Record<string, unknown>
): void {
  logSummarySave(`supabase ${operation} ${table}`, detail);
}

export function measurePayload(field: string, value: unknown): Record<string, unknown> {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    const bytes = new TextEncoder().encode(serialized).length;
    return {
      [`${field}Chars`]: serialized.length,
      [`${field}Bytes`]: bytes,
    };
  } catch (serializationError) {
    return {
      [`${field}SerializationError`]:
        serializationError instanceof Error ? serializationError.message : String(serializationError),
    };
  }
}
