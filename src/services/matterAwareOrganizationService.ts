/**
 * Phase 4: matter-aware organizational guidance (not legal advice).
 * Suggests potential record gaps only when an Employment Matter tag is selected
 * and the record type does not appear represented in uploaded materials.
 */

import type { EmploymentMatterTagId } from '../app/constants/employmentMatter';
import { employmentMatterLabel } from '../app/constants/employmentMatter';
import type { ScanDocumentBucket } from './documentScanClassification';
import { legacyCategoryToScanBucket } from './documentScanClassification';
import { sanitizeGenerationPhrase } from './intakeGenerationVoice';
import type {
  EvidenceMappedTimelineEvent,
  IntakeFileOrganizationRecord,
  IntakeOrganizationSections,
} from './intakeOrganizationTypes';

export type MatterRecordPresence = 'high' | 'medium' | 'low' | 'none';

type MatterRecordTypeDef = {
  id: string;
  label: string;
  locatedLabel: string;
  keywords: readonly string[];
  legacyCategories?: readonly string[];
  documentTypeHints?: readonly string[];
  employmentTopicHints?: readonly string[];
  scanBuckets?: readonly ScanDocumentBucket[];
};

const MATTER_RECORD_TYPES: Partial<Record<EmploymentMatterTagId, readonly MatterRecordTypeDef[]>> = {
  wage_hour: [
    {
      id: 'pay_stubs',
      label: 'pay stub records',
      locatedLabel: 'Pay stubs',
      keywords: ['pay stub', 'paystub', 'wage statement', 'gross pay', 'net pay', 'pay period', 'earnings'],
      legacyCategories: ['Pay Records', 'Pay Records / Payroll'],
      documentTypeHints: ['payroll', 'pay stub', 'wage'],
      scanBuckets: ['Compensation & Payroll'],
    },
    {
      id: 'timesheets',
      label: 'timesheet records',
      locatedLabel: 'Timesheets',
      keywords: ['timesheet', 'time sheet', 'timecard', 'time card', 'hours worked', 'clock in', 'clock out'],
      legacyCategories: ['Time Records'],
      documentTypeHints: ['timesheet', 'timecard', 'time record'],
      scanBuckets: ['Scheduling, Attendance & Leave'],
    },
    {
      id: 'scheduling',
      label: 'scheduling records',
      locatedLabel: 'Scheduling records',
      keywords: ['schedule', 'shift', 'roster', 'work schedule', 'shift calendar'],
      legacyCategories: ['Time Records', 'Scheduling'],
      documentTypeHints: ['schedule', 'shift'],
      scanBuckets: ['Scheduling, Attendance & Leave'],
    },
    {
      id: 'payroll_communications',
      label: 'payroll communication records',
      locatedLabel: 'Payroll communications',
      keywords: ['payroll', 'wage adjustment', 'pay correction', 'overtime approval', 'pay dispute'],
      legacyCategories: ['Workplace Communications', 'Pay Records', 'Pay Records / Payroll'],
      employmentTopicHints: ['Payroll and wage records'],
      scanBuckets: ['Workplace Communications', 'Compensation & Payroll'],
    },
  ],
  harassment: [
    {
      id: 'hr_communications',
      label: 'HR communication records',
      locatedLabel: 'HR communications',
      keywords: ['human resources', ' hr ', 'hr department', 'personnel', 'employee relations'],
      legacyCategories: ['Workplace Communications', 'HR Review', 'Employment Status'],
      scanBuckets: ['Workplace Communications', 'Employment Records'],
    },
    {
      id: 'written_complaints',
      label: 'written complaint records',
      locatedLabel: 'Written complaints',
      keywords: ['complaint', 'formal complaint', 'grievance', 'incident report', 'reported'],
      legacyCategories: ['Workplace Communications', 'Incident & Workplace Evidence'],
      scanBuckets: ['Incident & Workplace Evidence', 'Workplace Communications'],
    },
    {
      id: 'witness_communications',
      label: 'witness communication records',
      locatedLabel: 'Witness communications',
      keywords: ['witness', 'statement', ' corroborat', 'observed', 'saw'],
      legacyCategories: ['Workplace Communications', 'Incident & Workplace Evidence'],
      scanBuckets: ['Incident & Workplace Evidence', 'Workplace Communications'],
    },
    {
      id: 'manager_responses',
      label: 'manager response records',
      locatedLabel: 'Manager responses',
      keywords: ['manager', 'supervisor', 'response', 'follow-up', 'investigation', 'corrective action'],
      legacyCategories: ['Workplace Communications', 'Employment Status'],
      scanBuckets: ['Workplace Communications'],
    },
  ],
  retaliation: [
    {
      id: 'complaint_records',
      label: 'complaint records',
      locatedLabel: 'Complaint records',
      keywords: ['complaint', 'reported', 'grievance', 'whistle', 'ethics report'],
      legacyCategories: ['Workplace Communications', 'Incident & Workplace Evidence'],
      scanBuckets: ['Incident & Workplace Evidence', 'Workplace Communications'],
    },
    {
      id: 'follow_up_communications',
      label: 'follow-up communication records',
      locatedLabel: 'Follow-up communications',
      keywords: ['follow-up', 'follow up', 'response', 're:', 'fw:', 'after your report'],
      legacyCategories: ['Workplace Communications'],
      scanBuckets: ['Workplace Communications'],
    },
    {
      id: 'schedule_changes',
      label: 'schedule change records',
      locatedLabel: 'Schedule changes',
      keywords: ['schedule change', 'shift change', 'reassigned', 'demoted', 'hours reduced', 'transfer'],
      legacyCategories: ['Time Records', 'Employment Status'],
      scanBuckets: ['Scheduling, Attendance & Leave', 'Employment Records'],
    },
    {
      id: 'performance_discussions',
      label: 'performance discussion records',
      locatedLabel: 'Performance discussions',
      keywords: ['performance review', 'performance improvement', 'pip', 'write-up', 'warning', 'disciplinary'],
      legacyCategories: ['Employment Status', 'Workplace Communications'],
      scanBuckets: ['Employment Records', 'Workplace Communications'],
    },
  ],
  wrongful_termination: [
    {
      id: 'termination_notice',
      label: 'termination notice records',
      locatedLabel: 'Termination notices',
      keywords: ['termination', 'terminated', 'separation', 'layoff', 'laid off', 'resignation', 'last day'],
      legacyCategories: ['Employment Status', 'Separation'],
      documentTypeHints: ['termination', 'separation'],
      scanBuckets: ['Employment Records'],
    },
    {
      id: 'performance_reviews',
      label: 'performance review records',
      locatedLabel: 'Performance reviews',
      keywords: ['performance review', 'evaluation', 'appraisal', 'rating'],
      legacyCategories: ['Employment Status'],
      scanBuckets: ['Employment Records'],
    },
    {
      id: 'manager_communications',
      label: 'manager communication records',
      locatedLabel: 'Manager communications',
      keywords: ['manager', 'supervisor', 'director', 'email', 'memo'],
      legacyCategories: ['Workplace Communications'],
      scanBuckets: ['Workplace Communications'],
    },
    {
      id: 'exit_communications',
      label: 'exit communication records',
      locatedLabel: 'Exit communications',
      keywords: ['exit interview', 'final paycheck', 'cobra', 'severance', 'offboarding'],
      legacyCategories: ['Employment Status', 'Pay Records', 'Pay Records / Payroll'],
      scanBuckets: ['Employment Records', 'Compensation & Payroll'],
    },
  ],
  discrimination: [
    {
      id: 'hr_records',
      label: 'HR records',
      locatedLabel: 'HR records',
      keywords: ['human resources', ' hr ', 'personnel file', 'employee file'],
      legacyCategories: ['HR Review', 'Employment Status'],
      scanBuckets: ['Employment Records'],
    },
    {
      id: 'complaint_communications',
      label: 'complaint communication records',
      locatedLabel: 'Complaint communications',
      keywords: ['complaint', 'discrimination', 'harassment report', 'bias', 'unfair treatment'],
      legacyCategories: ['Workplace Communications', 'Incident & Workplace Evidence'],
      scanBuckets: ['Workplace Communications', 'Incident & Workplace Evidence'],
    },
    {
      id: 'policy_acknowledgements',
      label: 'policy acknowledgement records',
      locatedLabel: 'Policy acknowledgements',
      keywords: ['policy', 'handbook', 'acknowledgement', 'acknowledgment', 'signed', 'eeoc', 'anti-discrimination'],
      legacyCategories: ['Employment Status', 'HR Review'],
      scanBuckets: ['Employment Records'],
    },
    {
      id: 'performance_documentation',
      label: 'performance documentation records',
      locatedLabel: 'Performance documentation',
      keywords: ['performance', 'review', 'evaluation', 'write-up', 'warning'],
      legacyCategories: ['Employment Status'],
      scanBuckets: ['Employment Records'],
    },
  ],
  fmla_cfra: [
    {
      id: 'leave_requests',
      label: 'leave request records',
      locatedLabel: 'Leave requests',
      keywords: ['leave request', 'fmla', 'cfra', 'family leave', 'medical leave', 'time off request'],
      legacyCategories: ['Time Records', 'Employment Status'],
      scanBuckets: ['Scheduling, Attendance & Leave', 'Employment Records'],
    },
    {
      id: 'medical_certifications',
      label: 'medical certification records',
      locatedLabel: 'Medical certifications',
      keywords: ['medical certification', 'doctor note', 'physician', 'certification of health', 'fitness for duty'],
      legacyCategories: ['Time Records', 'Employment Status'],
      scanBuckets: ['Scheduling, Attendance & Leave'],
    },
    {
      id: 'approval_communications',
      label: 'leave approval communication records',
      locatedLabel: 'Approval communications',
      keywords: ['approved', 'approval', 'granted leave', 'leave approved'],
      legacyCategories: ['Workplace Communications', 'Time Records'],
      scanBuckets: ['Workplace Communications', 'Scheduling, Attendance & Leave'],
    },
    {
      id: 'denial_communications',
      label: 'leave denial communication records',
      locatedLabel: 'Denial communications',
      keywords: ['denied', 'denial', 'not approved', 'leave denied', 'unable to approve'],
      legacyCategories: ['Workplace Communications', 'Time Records'],
      scanBuckets: ['Workplace Communications'],
    },
    {
      id: 'fmla_scheduling',
      label: 'scheduling records',
      locatedLabel: 'Scheduling records',
      keywords: ['schedule', 'shift', 'return to work', 'intermittent leave'],
      legacyCategories: ['Time Records', 'Scheduling'],
      scanBuckets: ['Scheduling, Attendance & Leave'],
    },
  ],
  benefits_erisa: [
    {
      id: 'benefits_notices',
      label: 'benefits notice records',
      locatedLabel: 'Benefits notices',
      keywords: ['benefits notice', 'summary plan description', 'spd', 'cobra notice', 'open enrollment'],
      legacyCategories: ['Employment Status', 'HR Review'],
      scanBuckets: ['Employment Records'],
    },
    {
      id: 'enrollment_records',
      label: 'enrollment records',
      locatedLabel: 'Enrollment records',
      keywords: ['enrollment', 'enrolled', 'beneficiary', 'election form', '401k', 'health plan'],
      legacyCategories: ['Employment Status', 'HR Review'],
      scanBuckets: ['Employment Records'],
    },
    {
      id: 'denial_letters',
      label: 'benefits denial records',
      locatedLabel: 'Denial letters',
      keywords: ['denial letter', 'claim denied', 'benefits denied', 'adverse benefit determination'],
      legacyCategories: ['Workplace Communications', 'Employment Status'],
      scanBuckets: ['Employment Records', 'Workplace Communications'],
    },
    {
      id: 'plan_communications',
      label: 'plan communication records',
      locatedLabel: 'Plan communications',
      keywords: ['plan administrator', 'insurance', 'carrier', 'benefits department', 'erisa'],
      legacyCategories: ['Workplace Communications', 'HR Review'],
      scanBuckets: ['Workplace Communications', 'Employment Records'],
    },
  ],
  workplace_safety: [
    {
      id: 'incident_reports',
      label: 'incident report records',
      locatedLabel: 'Incident reports',
      keywords: ['incident report', 'accident report', 'injury report', 'osha', 'near miss'],
      legacyCategories: ['Incident & Workplace Evidence'],
      scanBuckets: ['Incident & Workplace Evidence'],
    },
    {
      id: 'safety_complaints',
      label: 'safety complaint records',
      locatedLabel: 'Safety complaints',
      keywords: ['safety complaint', 'unsafe', 'hazard', 'workplace safety', 'safety concern'],
      legacyCategories: ['Incident & Workplace Evidence', 'Workplace Communications'],
      scanBuckets: ['Incident & Workplace Evidence'],
    },
    {
      id: 'witness_statements',
      label: 'witness statement records',
      locatedLabel: 'Witness statements',
      keywords: ['witness statement', 'witness', 'observed', 'statement of'],
      legacyCategories: ['Incident & Workplace Evidence', 'Workplace Communications'],
      scanBuckets: ['Incident & Workplace Evidence'],
    },
    {
      id: 'internal_investigations',
      label: 'internal investigation records',
      locatedLabel: 'Internal investigations',
      keywords: ['investigation', 'internal review', 'fact finding', 'safety investigation'],
      legacyCategories: ['Incident & Workplace Evidence', 'Workplace Communications'],
      scanBuckets: ['Incident & Workplace Evidence'],
    },
  ],
  workplace_violence: [
    {
      id: 'violence_incident_reports',
      label: 'incident report records',
      locatedLabel: 'Incident reports',
      keywords: ['incident report', 'assault', 'threat', 'violence', 'battery'],
      legacyCategories: ['Incident & Workplace Evidence'],
      scanBuckets: ['Incident & Workplace Evidence'],
    },
    {
      id: 'violence_complaints',
      label: 'complaint records',
      locatedLabel: 'Complaint records',
      keywords: ['complaint', 'threatening', 'harassment', 'reported'],
      legacyCategories: ['Workplace Communications', 'Incident & Workplace Evidence'],
      scanBuckets: ['Incident & Workplace Evidence', 'Workplace Communications'],
    },
    {
      id: 'violence_witness_statements',
      label: 'witness statement records',
      locatedLabel: 'Witness statements',
      keywords: ['witness', 'statement', 'observed'],
      legacyCategories: ['Incident & Workplace Evidence'],
      scanBuckets: ['Incident & Workplace Evidence'],
    },
    {
      id: 'violence_investigations',
      label: 'investigation records',
      locatedLabel: 'Investigation records',
      keywords: ['investigation', 'security', 'police report', ' restraining'],
      legacyCategories: ['Incident & Workplace Evidence'],
      scanBuckets: ['Incident & Workplace Evidence'],
    },
  ],
  whistleblower: [
    {
      id: 'internal_reports',
      label: 'internal report records',
      locatedLabel: 'Internal reports',
      keywords: ['internal report', 'ethics hotline', 'compliance report', 'whistleblower'],
      legacyCategories: ['Workplace Communications', 'Incident & Workplace Evidence'],
      scanBuckets: ['Workplace Communications', 'Incident & Workplace Evidence'],
    },
    {
      id: 'ethics_complaints',
      label: 'ethics complaint records',
      locatedLabel: 'Ethics complaints',
      keywords: ['ethics', 'compliance', 'misconduct', 'fraud', 'retaliation'],
      legacyCategories: ['Workplace Communications'],
      scanBuckets: ['Workplace Communications'],
    },
    {
      id: 'whistle_follow_up',
      label: 'follow-up communication records',
      locatedLabel: 'Follow-up communications',
      keywords: ['follow-up', 'investigation update', 'response to your report'],
      legacyCategories: ['Workplace Communications'],
      scanBuckets: ['Workplace Communications'],
    },
    {
      id: 'investigation_notices',
      label: 'investigation notice records',
      locatedLabel: 'Investigation notices',
      keywords: ['investigation notice', 'investigation opened', 'review commenced'],
      legacyCategories: ['Workplace Communications', 'Incident & Workplace Evidence'],
      scanBuckets: ['Workplace Communications'],
    },
  ],
  labor_union: [
    {
      id: 'grievances',
      label: 'grievance records',
      locatedLabel: 'Grievances',
      keywords: ['grievance', 'union grievance', 'contract violation'],
      legacyCategories: ['Workplace Communications', 'Employment Status'],
      scanBuckets: ['Workplace Communications', 'Employment Records'],
    },
    {
      id: 'union_communications',
      label: 'union communication records',
      locatedLabel: 'Union communications',
      keywords: ['union', 'steward', 'collective bargaining', 'local chapter'],
      legacyCategories: ['Workplace Communications'],
      scanBuckets: ['Workplace Communications'],
    },
    {
      id: 'cb_materials',
      label: 'collective bargaining records',
      locatedLabel: 'Collective bargaining materials',
      keywords: ['collective bargaining', 'cba', 'bargaining agreement', 'contract proposal'],
      legacyCategories: ['Employment Status'],
      scanBuckets: ['Employment Records'],
    },
    {
      id: 'meeting_records',
      label: 'meeting record records',
      locatedLabel: 'Meeting records',
      keywords: ['meeting minutes', 'union meeting', 'bargaining session'],
      legacyCategories: ['Workplace Communications'],
      scanBuckets: ['Workplace Communications'],
    },
  ],
  disability_accommodation: [
    {
      id: 'accommodation_requests',
      label: 'accommodation request records',
      locatedLabel: 'Accommodation requests',
      keywords: ['accommodation request', 'reasonable accommodation', 'ada request', 'interactive process'],
      legacyCategories: ['Employment Status', 'HR Review'],
      scanBuckets: ['Employment Records'],
    },
    {
      id: 'medical_documentation',
      label: 'medical documentation records',
      locatedLabel: 'Medical documentation',
      keywords: ['medical documentation', 'doctor note', 'restriction', 'functional limitation'],
      legacyCategories: ['Time Records', 'Employment Status'],
      scanBuckets: ['Scheduling, Attendance & Leave', 'Employment Records'],
    },
    {
      id: 'accommodation_responses',
      label: 'accommodation response records',
      locatedLabel: 'Accommodation responses',
      keywords: ['accommodation approved', 'accommodation denied', 'interactive process', 'response to request'],
      legacyCategories: ['Workplace Communications', 'HR Review'],
      scanBuckets: ['Workplace Communications', 'Employment Records'],
    },
  ],
  independent_contractor: [
    {
      id: 'contractor_agreements',
      label: 'contractor agreement records',
      locatedLabel: 'Contractor agreements',
      keywords: ['independent contractor', '1099', 'contractor agreement', 'consulting agreement'],
      legacyCategories: ['Employment Status'],
      documentTypeHints: ['contract', 'agreement'],
      scanBuckets: ['Employment Records'],
    },
    {
      id: 'payment_records',
      label: 'contractor payment records',
      locatedLabel: 'Payment records',
      keywords: ['1099', 'invoice', 'contractor payment', 'vendor payment'],
      legacyCategories: ['Pay Records', 'Pay Records / Payroll'],
      scanBuckets: ['Compensation & Payroll'],
    },
    {
      id: 'classification_communications',
      label: 'classification communication records',
      locatedLabel: 'Classification communications',
      keywords: ['misclassification', 'w-2', 'employee status', 'contractor status'],
      legacyCategories: ['Workplace Communications', 'Employment Status'],
      scanBuckets: ['Workplace Communications', 'Employment Records'],
    },
  ],
};

const MATTER_DERIVED_LINE_PATTERN =
  /Records related to .+ were located|No .+ were located|The available materials do not currently include|The available materials may not include all relevant|Additional records may help clarify .+ topics|No supporting records were located for .+ topics|This may be relevant for review against .+ topics/i;

function fileCorpus(record: IntakeFileOrganizationRecord): string {
  return [
    record.file_name,
    record.legacy_upload_category ?? '',
    record.document_type,
    ...record.employment_topics,
  ]
    .join(' ')
    .toLowerCase();
}

function keywordHits(corpus: string, keywords: readonly string[]): number {
  let hits = 0;
  for (const kw of keywords) {
    if (corpus.includes(kw.toLowerCase())) hits += 1;
  }
  return hits;
}

function legacyCategoryMatches(
  category: string | null,
  hints: readonly string[] | undefined
): boolean {
  if (!category || !hints?.length) return false;
  const c = category.trim().toLowerCase();
  return hints.some((h) => c === h.toLowerCase() || c.includes(h.toLowerCase()));
}

function matchRecordTypeForFile(
  record: IntakeFileOrganizationRecord,
  def: MatterRecordTypeDef
): MatterRecordPresence {
  const corpus = fileCorpus(record);
  const hits = keywordHits(corpus, def.keywords);
  const categoryMatch = legacyCategoryMatches(record.legacy_upload_category, def.legacyCategories);
  const bucket = legacyCategoryToScanBucket(record.legacy_upload_category);
  const bucketMatch = Boolean(def.scanBuckets?.includes(bucket));
  const docTypeMatch = def.documentTypeHints?.some((h) =>
    record.document_type.toLowerCase().includes(h.toLowerCase())
  );
  const topicMatch = def.employmentTopicHints?.some((h) =>
    record.employment_topics.some((t) => t.toLowerCase().includes(h.toLowerCase()))
  );

  if (record.extraction_quality === 'unreadable') {
    if (hits >= 2 || categoryMatch) return 'medium';
    if (hits >= 1 || bucketMatch) return 'low';
    return 'none';
  }

  if (hits >= 2 || (hits >= 1 && (categoryMatch || docTypeMatch || topicMatch))) return 'high';
  if (hits >= 1 || categoryMatch || docTypeMatch || topicMatch || bucketMatch) return 'medium';
  return 'none';
}

function aggregateRecordTypePresence(
  fileRecords: IntakeFileOrganizationRecord[],
  def: MatterRecordTypeDef
): MatterRecordPresence {
  let best: MatterRecordPresence = 'none';
  const rank: Record<MatterRecordPresence, number> = {
    none: 0,
    low: 1,
    medium: 2,
    high: 3,
  };
  for (const record of fileRecords) {
    const presence = matchRecordTypeForFile(record, def);
    if (rank[presence] > rank[best]) best = presence;
    if (best === 'high') return 'high';
  }
  return best;
}

function isRecordTypeLocated(presence: MatterRecordPresence): boolean {
  return presence === 'high' || presence === 'medium';
}

function assessCorpusCoverage(fileRecords: IntakeFileOrganizationRecord[]): 'strong' | 'partial' | 'weak' {
  if (!fileRecords.length) return 'weak';
  const readable = fileRecords.filter((f) => f.extraction_quality !== 'unreadable').length;
  if (readable >= 3 || readable / fileRecords.length >= 0.5) return 'strong';
  if (readable >= 1) return 'partial';
  return 'weak';
}

function absenceConfidence(
  fileRecords: IntakeFileOrganizationRecord[],
  coverage: 'strong' | 'partial' | 'weak'
): 'medium' | 'low' {
  if (coverage === 'strong') return 'medium';
  if (coverage === 'partial') return 'medium';
  return 'low';
}

function gapLineForMissingType(
  def: MatterRecordTypeDef,
  absence: 'medium' | 'low'
): { gap?: string; clarification?: string } {
  if (absence === 'medium') {
    return {
      gap: sanitizeGenerationPhrase(`No related records found yet: ${def.label}.`),
      clarification: sanitizeGenerationPhrase(
        `Not found in the current records: ${def.label}. Additional records may help complete this period.`
      ),
    };
  }
  return {
    clarification: sanitizeGenerationPhrase(
      `The current records may not include all ${def.label}.`
    ),
  };
}

export type MatterAwareGuidance = {
  potentialGaps: string[];
  clarificationItems: string[];
};

export function buildMatterAwareGuidance(opts: {
  matterTags: EmploymentMatterTagId[];
  fileRecords: IntakeFileOrganizationRecord[];
  evidenceTimeline: EvidenceMappedTimelineEvent[];
}): MatterAwareGuidance {
  const tags = opts.matterTags.filter((t) => t !== 'other_not_sure');
  const potentialGaps = new Set<string>();
  const clarificationItems = new Set<string>();
  const coverage = assessCorpusCoverage(opts.fileRecords);

  if (opts.matterTags.includes('other_not_sure')) {
    if (opts.fileRecords.length === 0) {
      potentialGaps.add(
        sanitizeGenerationPhrase('No related records found yet.')
      );
    } else {
      clarificationItems.add(
        sanitizeGenerationPhrase('Additional records may help complete the topics reflected in this intake.')
      );
      if (coverage === 'weak') {
        potentialGaps.add(
          sanitizeGenerationPhrase('The current records may not include all related records.')
        );
      }
    }
  }

  if (!tags.length) {
    return {
      potentialGaps: [...potentialGaps],
      clarificationItems: [...clarificationItems],
    };
  }

  for (const tag of tags) {
    const defs = MATTER_RECORD_TYPES[tag];
    if (!defs?.length) continue;

    const matterLabel = employmentMatterLabel(tag);
    const located: string[] = [];

    for (const def of defs) {
      const presence = aggregateRecordTypePresence(opts.fileRecords, def);
      if (isRecordTypeLocated(presence)) {
        located.push(def.locatedLabel);
        continue;
      }

      const absence = absenceConfidence(opts.fileRecords, coverage);
      const { gap, clarification } = gapLineForMissingType(def, absence);
      if (gap) potentialGaps.add(gap);
      if (clarification) clarificationItems.add(clarification);
    }

    if (located.length) {
      clarificationItems.add(
        sanitizeGenerationPhrase(
          `Records mention ${matterLabel}: ${located.join(', ')}.`
        )
      );
    } else if (opts.fileRecords.length > 0 && coverage !== 'weak') {
      clarificationItems.add(
        sanitizeGenerationPhrase(
          `No related records found yet for ${matterLabel} topics. Additional records may help complete this area.`
        )
      );
    } else if (opts.fileRecords.length > 0) {
      clarificationItems.add(
        sanitizeGenerationPhrase(`Additional records may help complete ${matterLabel} topics.`)
      );
    }

    const timelineTopics = opts.evidenceTimeline.flatMap((e) => e.related_topics);
    if (timelineTopics.length >= 2 && located.length >= 1) {
      clarificationItems.add(
        sanitizeGenerationPhrase(
          `This may help review timeline entries related to ${matterLabel} topics.`
        )
      );
    }
  }

  return {
    potentialGaps: [...potentialGaps],
    clarificationItems: [...clarificationItems],
  };
}

export function stripMatterDerivedSectionLines(lines: string[]): string[] {
  return lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return false;
    MATTER_DERIVED_LINE_PATTERN.lastIndex = 0;
    return !MATTER_DERIVED_LINE_PATTERN.test(trimmed);
  });
}

export function appendMatterAwareGuidanceToSections(
  sections: IntakeOrganizationSections,
  opts: {
    matterTags: EmploymentMatterTagId[];
    fileRecords: IntakeFileOrganizationRecord[];
    evidenceTimeline: EvidenceMappedTimelineEvent[];
  }
): IntakeOrganizationSections {
  if (!opts.matterTags.length) return sections;

  const guidance = buildMatterAwareGuidance(opts);
  const baseGaps = stripMatterDerivedSectionLines(sections.potential_gaps);
  const baseClarifications = stripMatterDerivedSectionLines(sections.clarification_items);

  const potential_gaps = [...new Set([...baseGaps, ...guidance.potentialGaps])].slice(0, 12);
  const clarification_items = [...new Set([...baseClarifications, ...guidance.clarificationItems])].slice(
    0,
    10
  );

  return { ...sections, potential_gaps, clarification_items };
}
