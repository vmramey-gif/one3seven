import { describe, expect, test } from 'vitest';
import { buildDocumentGroundedOrganization } from '../documentGroundedOrganizationService';
import type { DocumentFacts } from '../documentFactsService';
import type { DocumentGroundedFileInput } from '../intakeOrganizationTypes';

/**
 * Semantic-event titling gauntlet (2026-08-18, requested after the Marcus Delgado event-semantics
 * fix). That fix closed one instance of a class of bug: a document gets titled from a KEYWORD it
 * merely CONTAINS ("overtime", "pay", "schedule", "termination", "complaint", "disability"...)
 * rather than from what the document actually IS. This gauntlet is broader than any one case: 16
 * realistic document/communication types, several deliberately carrying trap keywords that belong
 * to a DIFFERENT category, run through the real end-to-end pipeline
 * (buildDocumentGroundedOrganization -- per-file records, deterministic pay/communication fact
 * extraction, document_facts wiring, clustering, title guards). Each case asserts the resulting
 * event title is neutral/factual and is NOT the wrong category's title.
 */

function facts(p: Partial<DocumentFacts>): DocumentFacts {
  return {
    category: '', file_name: '', extracted_at: '', confidence: 'high',
    document_date: null, people_mentioned: [], employer_name: null, stated_reason: null,
    issued_by: null, policy_cited: null, complaint_topic: null, complaint_date: null,
    resolution_summary: null, start_date: null, position_title: null, pay_rate: null,
    pay_period_start: null, pay_period_end: null, gross_pay: null, net_pay: null,
    regular_hours: null, overtime_hours: null, overtime_rate: null, missed_breaks: null,
    period_covered: null, schedule_change_description: null, effective_date: null,
    witness_name: null, events_corroborated: [], relationship_to_worker: null,
    key_quote: null, flags: [], ...p,
  } as DocumentFacts;
}

type GauntletCase = {
  label: string;
  fileName: string;
  category: string;
  extractedText: string;
  documentFacts?: Partial<DocumentFacts>;
  /** Every one of these must appear in the produced title (case-insensitive substring). */
  expectTitleContains?: string[];
  /** None of these may appear anywhere in the produced title. */
  expectTitleExcludes: RegExp[];
};

const CASES: GauntletCase[] = [
  {
    label: 'worker emails HR complaining about unpaid overtime',
    // Trap: filename carries "overtime" and "pay" -- must not become a payroll-record title. Also
    // traps the response-direction matcher: the worker's own words ask for "a response" and to
    // have this "investigated" -- must not flip this into "HR response received" (2026-08-18
    // gauntlet finding, fixed in eventCandidateFromCommunication).
    fileName: 'overtime_pay_concern_email.pdf',
    category: 'Workplace Communications',
    extractedText: `From: Marcus Delgado\nTo: Human Resources\nDate: June 9, 2026\nSubject: Overtime pay concern\n\nI want to submit a formal workplace concern: I have not been paid correctly for overtime hours I worked over the past two pay periods. I'm submitting this to HR for review and would appreciate a response.`,
    documentFacts: {
      complaint_topic: 'Unpaid overtime hours',
      communication_parties: [
        { name: 'Marcus Delgado', role: 'sender' },
        { name: 'Human Resources', role: 'recipient' },
      ] as any,
    },
    expectTitleContains: ['complaint', 'human resources'],
    expectTitleExcludes: [/pay period or overtime record/i, /schedule change/i, /termination/i, /hr response received/i],
  },
  {
    label: "HR acknowledges the complaint",
    fileName: 're_overtime_concern_response.pdf',
    category: 'HR Documents',
    extractedText: `From: Renee Ashford\nTo: Marcus Delgado\nDate: June 10, 2026\nSubject: RE: Overtime pay concern\n\nThank you for bringing this to our attention. I have received your message about unpaid overtime and am looking into your concern. I've forwarded this to payroll for review and will follow up.`,
    documentFacts: {
      complaint_topic: 'Unpaid overtime hours',
      resolution_summary: 'Forwarded to payroll for review; will follow up.',
      issued_by: 'Renee Ashford',
      relationship_to_worker: 'HR Manager',
    },
    expectTitleContains: ['hr response'],
    expectTitleExcludes: [/pay period or overtime record/i, /complaint submitted/i, /schedule change/i],
  },
  {
    label: 'manager sends a performance warning',
    // Trap: text discusses schedule adherence -- must not become "Schedule change documented".
    fileName: 'written_warning_notice.pdf',
    category: 'Performance / discipline records',
    extractedText: `WRITTEN WARNING\n\nEmployee: Marcus Delgado\nIssued by: Store Manager\nDate: July 2, 2026\n\nThis written warning is issued regarding repeated tardiness and failure to adhere to your assigned schedule. Continued issues may result in further discipline.`,
    documentFacts: {
      issued_by: 'Store Manager',
      relationship_to_worker: 'Manager',
      stated_reason: 'Repeated tardiness and schedule adherence',
    },
    expectTitleContains: ['written warning'],
    expectTitleExcludes: [/schedule change/i, /termination/i, /complaint/i],
  },
  {
    label: 'employee asks for a disability accommodation',
    // Trap: filename/text mention "schedule" (a modified schedule is the requested accommodation).
    fileName: 'accommodation_request_modified_schedule.pdf',
    category: 'Workplace Communications',
    extractedText: `From: Marcus Delgado\nTo: Human Resources\nDate: August 1, 2026\nSubject: Request for accommodation\n\nI am writing to request a reasonable accommodation for a disability. I'm asking whether my schedule could be adjusted to allow for medical appointments. Please let me know what documentation is needed.`,
    documentFacts: {
      complaint_topic: 'Reasonable accommodation request',
    },
    expectTitleContains: ['accommodation'],
    expectTitleExcludes: [/schedule change documented/i, /written warning/i, /termination/i],
  },
  {
    label: "HR requests medical certification",
    // Trap: text literally contains the phrase "leave request" even though HR is the sender, not
    // the worker -- must not silently flip into "Worker requests leave or accommodation".
    fileName: 'medical_certification_needed.pdf',
    category: 'HR Documents',
    extractedText: `From: Renee Ashford\nTo: Marcus Delgado\nDate: August 5, 2026\nSubject: Medical certification needed\n\nTo process your leave request, please provide medical certification from your physician within 15 days. HR is reviewing your accommodation request and needs this documentation to proceed.`,
    documentFacts: {
      issued_by: 'Renee Ashford',
      relationship_to_worker: 'HR Manager',
      stated_reason: 'Medical certification requested to process accommodation',
    },
    expectTitleExcludes: [/pay period or overtime record/i, /termination/i, /written warning/i],
  },
  {
    label: 'worker reports harassment',
    fileName: 'harassment_report.pdf',
    category: 'Workplace Communications',
    extractedText: `From: Marcus Delgado\nTo: Human Resources\nDate: August 10, 2026\nSubject: Formal complaint - harassment\n\nI want to file a formal complaint with HR regarding comments a coworker has repeatedly made toward me at work. I'd like this investigated.`,
    documentFacts: {
      complaint_topic: 'Harassment by a coworker',
    },
    expectTitleContains: ['complaint', 'human resources'],
    expectTitleExcludes: [/schedule change/i, /pay period or overtime record/i, /termination/i, /^formal complaint - harassment$/i],
  },
  {
    label: 'payroll sends a wage correction notice',
    // Trap: "correction" + mentions of an earlier complaint -- must not become "Complaint submitted".
    fileName: 'payroll_wage_correction_notice.pdf',
    category: 'Compensation & Payroll',
    extractedText: `PAYROLL DEPARTMENT\n\nDate: August 12, 2026\nEmployee: Marcus Delgado\n\nThis notice confirms a wage correction has been processed for the overtime hours previously reported as missing. An adjustment of $340.00 will appear on your next pay stub.`,
    expectTitleContains: ['pay'],
    expectTitleExcludes: [/complaint submitted/i, /hr response/i, /schedule change/i, /termination/i],
  },
  {
    label: 'termination letter',
    fileName: 'termination_letter.pdf',
    category: 'Separation Records',
    extractedText: `NOTICE OF TERMINATION\n\nEmployee: Marcus Delgado\nDate: September 1, 2026\n\nThis letter confirms your employment with the company is terminated effective September 1, 2026. Your final paycheck will include all wages owed through your last day worked.`,
    documentFacts: { stated_reason: 'Position eliminated' },
    expectTitleContains: ['termination'],
    expectTitleExcludes: [/schedule change/i, /pay period or overtime record/i, /complaint/i],
  },
  {
    label: 'resignation email',
    // Trap: filename contains "termination"-adjacent word "final" -- must read as a resignation,
    // not a termination.
    fileName: 'resignation_final_day_notice.pdf',
    category: 'Separation Records',
    extractedText: `From: Marcus Delgado\nTo: Renee Ashford\nDate: September 3, 2026\nSubject: Resignation\n\nI am writing to formally resign from my position, effective September 17, 2026. Thank you for the opportunity.`,
    expectTitleContains: ['employment ends'],
    expectTitleExcludes: [/written warning/i, /pay period or overtime record/i, /schedule change/i],
  },
  {
    label: 'timecard',
    // Trap: filename/category both scream "pay"/"overtime" -- must read as a time/pay RECORD, not
    // an asserted schedule change and not a communication.
    fileName: 'weekly_timecard_08-2026.pdf',
    category: 'Time & Attendance',
    extractedText: `TIME CARD\n\nEmployee: Marcus Delgado\nWeek ending: August 16, 2026\nRegular hours: 40.0\nOvertime hours: 6.5\nTotal hours: 46.5`,
    documentFacts: { regular_hours: '40.0', overtime_hours: '6.5' },
    expectTitleContains: ['pay period or overtime record'],
    expectTitleExcludes: [/schedule change/i, /complaint/i, /termination/i],
  },
  {
    label: 'schedule screenshot',
    fileName: 'schedule_screenshot_week34.pdf',
    category: 'Time & Attendance',
    extractedText: `WEEKLY SCHEDULE\n\nEmployee: Marcus Delgado\nMon 9-5, Tue 9-5, Wed OFF, Thu 9-5, Fri 9-5\nWeek of August 18, 2026`,
    expectTitleContains: ['schedule change'],
    expectTitleExcludes: [/pay period or overtime record/i, /complaint/i, /termination/i, /written warning/i],
  },
  {
    label: 'paystub',
    fileName: 'paystub_aug_2026.pdf',
    category: 'Compensation & Payroll',
    extractedText: `PAY STUB\n\nEmployee: Marcus Delgado\nPay period: August 1 - August 15, 2026\nGross pay: $2,100.00\nEmployer: Acme Logistics`,
    documentFacts: { gross_pay: '$2,100.00', pay_period_start: '2026-08-01', pay_period_end: '2026-08-15' },
    expectTitleContains: ['pay period or overtime record'],
    expectTitleExcludes: [/schedule change/i, /complaint/i, /termination/i],
  },
  {
    label: 'offer letter',
    // Trap: mentions "termination" in standard at-will boilerplate -- must not become
    // "Termination documented".
    fileName: 'offer_letter.pdf',
    category: 'Offer Letters',
    extractedText: `OFFER OF EMPLOYMENT\n\nDear Marcus Delgado,\n\nWe are pleased to offer you the position of Warehouse Associate, starting March 3, 2026. Employment is at-will and may be subject to termination by either party at any time.`,
    documentFacts: { position_title: 'Warehouse Associate', start_date: '2026-03-03' },
    expectTitleContains: ['employment begins'],
    expectTitleExcludes: [/termination documented/i, /pay period or overtime record/i, /schedule change/i],
  },
  {
    label: "doctor's note",
    // Trap: mentions "leave" -- must not be swallowed into the accommodation-request vocabulary
    // reserved for the worker's own request; this is a third-party medical record.
    fileName: 'doctors_note.pdf',
    category: 'Medical Records',
    extractedText: `Dr. A. Chen, MD\nDate: August 20, 2026\n\nRe: Marcus Delgado\n\nThis patient is advised to take leave from work from 8/20/2026 through 8/27/2026 for a medical condition. Please excuse this absence.`,
    expectTitleExcludes: [
      /pay period or overtime record/i,
      /termination/i,
      /schedule change/i,
      /written warning/i,
      /complaint submitted/i,
    ],
  },
  {
    label: 'reimbursement receipt',
    fileName: 'mileage_reimbursement_receipt.pdf',
    category: 'Expense Records',
    extractedText: `EXPENSE REIMBURSEMENT REQUEST\n\nEmployee: Marcus Delgado\nDate: August 22, 2026\nMileage: 42 miles, business travel\nAmount: $27.30`,
    expectTitleExcludes: [/complaint/i, /termination/i, /written warning/i, /schedule change documented/i],
  },
  {
    label: 'unrelated casual email',
    // Trap: mentions "pay" casually (splitting a lunch tab) -- must not become a payroll-record
    // title, and must not be swept into any employment-event vocabulary at all.
    fileName: 'lunch_plans.pdf',
    category: 'Uncategorized',
    extractedText: `From: Marcus Delgado\nTo: Renee Ashford\nDate: August 24, 2026\nSubject: Lunch tomorrow?\n\nHey, want to grab lunch tomorrow? I can pay for mine, no worries about splitting it.`,
    expectTitleExcludes: [
      /pay period or overtime record/i,
      /complaint submitted/i,
      /hr response/i,
      /termination/i,
      /schedule change/i,
      /written warning/i,
    ],
  },
];

function titleForCase(c: GauntletCase): string {
  const input: DocumentGroundedFileInput = {
    uploadedFileId: 'f1',
    fileName: c.fileName,
    category: c.category,
    extractedText: c.extractedText,
    documentFacts: c.documentFacts
      ? (facts({ category: c.category, file_name: c.fileName, ...c.documentFacts }) as any)
      : null,
  };
  const result = buildDocumentGroundedOrganization(
    [{ fileName: c.fileName, category: c.category, uploadedFileId: 'f1' }],
    [input],
    null
  );
  const events = result?.evidenceTimeline ?? [];
  expect(events.length, `${c.label}: expected exactly one event, got ${events.length}`).toBe(1);
  return events[0].title;
}

describe('semantic-event titling gauntlet (2026-08-18) — 16 document/communication types, several with trap keywords belonging to a different category', () => {
  for (const c of CASES) {
    test(c.label, () => {
      const title = titleForCase(c);
      const lower = title.toLowerCase();
      for (const fragment of c.expectTitleContains ?? []) {
        expect(lower, `"${c.label}" produced "${title}", expected it to mention "${fragment}"`).toContain(
          fragment.toLowerCase()
        );
      }
      for (const badPattern of c.expectTitleExcludes) {
        expect(title, `"${c.label}" produced "${title}", which wrongly matches ${badPattern}`).not.toMatch(
          badPattern
        );
      }
    });
  }
});
