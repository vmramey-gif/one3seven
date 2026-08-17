/**
 * Record-type vocabulary shared by the records-request letter generator (RecordsRequestScreen)
 * and the claim-lens gap-cart feature (claimLensGapActions.ts).
 *
 * This file used to also hold a full worker-owned records-request activity log (persisted as an
 * `--- O3S_RECORDS_REQUEST_LOG ---` block in intake_summaries.overview, mirroring the mitigation
 * log's pattern) -- built and tested, but never wired into RecordsRequestScreen.tsx, which has no
 * intakeId prop or persistence callback. Removed 2026-08-17 (worker audit finding C13: two
 * disconnected, incompatible implementations of the same "sent/response received" tracking
 * feature existed side by side). Recoverable from git history if this gets built for real later.
 */

export type RecordType = 'personnel_file' | 'pay_records' | 'time_records' | 'signed_documents';

export const RECORD_TYPES: readonly RecordType[] = ['personnel_file', 'pay_records', 'time_records', 'signed_documents'];
