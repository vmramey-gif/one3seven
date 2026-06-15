/** Production-safe organization pipeline audit logs (no document content). */
export function logOrgAudit(
  step: string,
  detail: Record<string, unknown> & { intakeId: string }
): void {
  console.info(`[o3s-org-audit] ${step}`, detail);
}

export function logOrgAuditError(
  step: string,
  error: unknown,
  detail: Record<string, unknown> & { intakeId: string }
): void {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(`[o3s-org-audit] ${step}`, {
    ...detail,
    success: false,
    errorMessage: err.message,
    errorName: err.name,
  });
}

export type OrgAuditBoundaryResult = {
  step: string;
  success: boolean;
  errorMessage?: string;
  fallbackUsed?: boolean;
};

export function logOrgAuditBoundary(
  intakeId: string,
  result: OrgAuditBoundaryResult
): void {
  const level = result.success ? 'info' : 'warn';
  const payload = {
    intakeId,
    step: result.step,
    success: result.success,
    fallbackUsed: result.fallbackUsed ?? false,
    errorMessage: result.errorMessage ?? null,
  };
  if (level === 'info') {
    console.info(`[o3s-org-audit] boundary ${result.step}`, payload);
  } else {
    console.warn(`[o3s-org-audit] boundary ${result.step}`, payload);
  }
}
