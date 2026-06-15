/**
 * Document scan buckets and text-assisted classification helpers.
 * Shared by grounded organization and per-file record building.
 */

export const SCAN_DOCUMENT_BUCKETS = [
  'Compensation & Payroll',
  'Employment Records',
  'Workplace Communications',
  'Scheduling, Attendance & Leave',
  'Incident & Workplace Evidence',
  'Identity & Professional Verification',
  'Additional Supporting Records',
] as const;

export type ScanDocumentBucket = (typeof SCAN_DOCUMENT_BUCKETS)[number];

export const REVIEW_TOPIC_DEFINITIONS: ReadonlyArray<{
  label: string;
  terms: readonly string[];
  review: string;
  clarifying: string;
}> = [
  {
    label: 'Payroll and wage records',
    terms: ['payroll', 'pay stub', 'paystub', 'wages', 'overtime', 'hourly', 'pay period', 'earnings', 'commission', 'bonus'],
    review: 'pay amounts, periods, and time records should be compared in the source files',
    clarifying: 'pay stubs or wage statements for the same periods',
  },
  {
    label: 'Scheduling and timekeeping',
    terms: ['timesheet', 'timecard', 'schedule', 'shift', 'clock in', 'clock out', 'meal break', 'rest break', 'pto', 'leave', 'fmla', 'sick'],
    review: 'logged hours and schedules should be compared with pay records where both exist',
    clarifying: 'time records or schedules for the same dates',
  },
  {
    label: 'Separation or final pay',
    terms: ['termination', 'terminated', 'separation', 'resignation', 'laid off', 'layoff', 'severance', 'final paycheck', 'final pay'],
    review: 'separation paperwork and final pay records should be read together for timing',
    clarifying: 'termination or final pay records',
  },
  {
    label: 'Workplace communications',
    terms: ['human resources', 'hr', 'complaint', 'reported', 'manager', 'supervisor', 'email', 'memo', 'investigation', 'write-up', 'warning'],
    review: 'messages and HR documents should be read in date order with related records',
    clarifying: 'communications from the same timeframe',
  },
  {
    label: 'Leave or accommodation references',
    terms: ['accommodation', 'disability', 'ada', 'pregnancy', 'maternity', 'medical leave', 'doctor', 'restriction', 'interactive process'],
    review: 'leave or accommodation references should be matched to dates in other uploads',
    clarifying: 'leave requests, restrictions, or related medical paperwork',
  },
  {
    label: 'Offer or pay structure',
    terms: ['offer letter', 'employment agreement', 'contract', 'exempt', 'non-exempt', 'independent contractor', '1099', 'salary', 'commission agreement'],
    review: 'offer terms and pay records should be compared for classification and pay wording',
    clarifying: 'offer letter or employment agreement',
  },
];

const BUCKET_KEYWORDS: Record<ScanDocumentBucket, readonly string[]> = {
  'Compensation & Payroll': [
    'pay stub',
    'paystub',
    'payroll',
    'gross pay',
    'net pay',
    'hourly rate',
    'overtime',
    'flsa',
    'deduction',
    'ytd',
    'pay period',
    'w-2',
    'w2',
    '1099',
    'commission',
    'bonus',
    'wage statement',
    'earnings statement',
  ],
  'Employment Records': [
    'offer letter',
    'job description',
    'handbook',
    'policy',
    'at-will',
    'performance review',
    'termination',
    'separation',
    'resignation',
    'personnel file',
    'employment agreement',
  ],
  'Workplace Communications': [
    'email thread',
    'slack',
    'teams message',
    'memo',
    'correspondence',
    'message from',
    'subject:',
    'cc:',
    'bcc:',
  ],
  'Scheduling, Attendance & Leave': [
    'timesheet',
    'time card',
    'timecard',
    'schedule',
    'pto',
    'fmla',
    'sick leave',
    'vacation',
    'attendance',
    'clock in',
    'clock out',
    'shift',
  ],
  'Incident & Workplace Evidence': [
    'incident report',
    'investigation',
    'witness',
    'corrective action',
    'disciplinary',
    'write-up',
    'warning notice',
    'grievance',
    'workplace safety',
    'osha',
  ],
  'Identity & Professional Verification': [
    'i-9',
    'i9',
    'passport',
    'driver license',
    'drivers license',
    'background check',
    'verification',
    'credentials',
    'certification',
    'social security',
    'employer id',
  ],
  'Additional Supporting Records': ['reimbursement', 'expense report', 'mileage', 'receipt', 'invoice'],
};

const EXTRA_BUCKET_SIGNALS: ReadonlyArray<{ kw: string; bucket: ScanDocumentBucket; bonus: number }> = [
  { kw: 'payroll', bonus: 2, bucket: 'Compensation & Payroll' },
  { kw: 'paycheck', bonus: 2, bucket: 'Compensation & Payroll' },
  { kw: 'pay period', bonus: 2, bucket: 'Compensation & Payroll' },
  { kw: 'direct deposit', bonus: 2, bucket: 'Compensation & Payroll' },
  { kw: 'tax withholding', bonus: 2, bucket: 'Compensation & Payroll' },
  { kw: 'hourly', bonus: 1, bucket: 'Compensation & Payroll' },
  { kw: 'wages', bonus: 1, bucket: 'Compensation & Payroll' },
  { kw: 'timekeeping', bonus: 2, bucket: 'Scheduling, Attendance & Leave' },
  { kw: 'time keeping', bonus: 2, bucket: 'Scheduling, Attendance & Leave' },
  { kw: 'hours worked', bonus: 2, bucket: 'Scheduling, Attendance & Leave' },
  { kw: 'meal break', bonus: 1, bucket: 'Scheduling, Attendance & Leave' },
  { kw: 'rest break', bonus: 1, bucket: 'Scheduling, Attendance & Leave' },
  { kw: 'personnel', bonus: 1, bucket: 'Employment Records' },
  { kw: 'employee file', bonus: 2, bucket: 'Employment Records' },
  { kw: 'employment record', bonus: 2, bucket: 'Employment Records' },
  { kw: 'severance', bonus: 1, bucket: 'Employment Records' },
  { kw: 'cobra', bonus: 1, bucket: 'Employment Records' },
];

export function legacyCategoryToScanBucket(category: string | null | undefined): ScanDocumentBucket {
  const c = (category ?? 'Uncategorized').trim();
  if (c === 'Pay Records / Payroll' || c === 'Pay Records') return 'Compensation & Payroll';
  if (c === 'Time Records' || c === 'PTO Records') return 'Scheduling, Attendance & Leave';
  if (c === 'Workplace Communications') return 'Workplace Communications';
  if (c === 'Offer Letters' || c === 'HR Documents' || c === 'Performance Reviews') return 'Employment Records';
  if (c === 'Reimbursement Records') return 'Additional Supporting Records';
  return 'Additional Supporting Records';
}

export function scoreTextAgainstBuckets(lowerText: string): Map<ScanDocumentBucket, number> {
  const scores = new Map<ScanDocumentBucket, number>();
  for (const b of SCAN_DOCUMENT_BUCKETS) scores.set(b, 0);
  for (const bucket of SCAN_DOCUMENT_BUCKETS) {
    let s = 0;
    for (const kw of BUCKET_KEYWORDS[bucket]) {
      if (lowerText.includes(kw)) s += 1;
    }
    scores.set(bucket, s);
  }
  for (const { kw, bucket, bonus } of EXTRA_BUCKET_SIGNALS) {
    if (lowerText.includes(kw)) scores.set(bucket, (scores.get(bucket) ?? 0) + bonus);
  }
  return scores;
}

export function bestBucketFromScores(scores: Map<ScanDocumentBucket, number>): { bucket: ScanDocumentBucket; top: number } {
  let top = 0;
  for (const b of SCAN_DOCUMENT_BUCKETS) top = Math.max(top, scores.get(b) ?? 0);
  if (top === 0) return { bucket: 'Additional Supporting Records', top: 0 };
  for (const b of SCAN_DOCUMENT_BUCKETS) {
    if ((scores.get(b) ?? 0) === top) return { bucket: b, top };
  }
  return { bucket: 'Additional Supporting Records', top: 0 };
}

export function employmentTopicLabelsForText(lowerText: string, minHits = 2, max = 4): string[] {
  const labels: string[] = [];
  for (const def of REVIEW_TOPIC_DEFINITIONS) {
    const hits = def.terms.filter((term) => lowerText.includes(term));
    if (hits.length >= minHits && !labels.includes(def.label)) {
      labels.push(def.label);
    }
    if (labels.length >= max) break;
  }
  return labels;
}
