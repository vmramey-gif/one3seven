import { describe, expect, test } from 'vitest';
import {
  buildExecutiveSummary,
  buildWorkerAccount,
  pickSupportingRecordsForEvent,
  presentPacketEventDate,
  presentPacketTimelineStoryTitle,
} from '../packetStoryPresentation';
import { buildIntakePacketHtml, buildIntakePacketViewModel, collectIntakePacketPdfLines } from '../intakePacketPresentation';
import { ATTORNEY_PACKET_SECTIONS } from '../../app/constants/workerStoryIntake';
import type { IntakeSummaryDownloadPayload } from '../intakeSummaryDownload';

const BASE: IntakeSummaryDownloadPayload = {
  intakeNumber: 'INT-001',
  firmCode: 'FIRM-42',
  intakeStatus: 'Submitted',
  workerName: 'Alex Rivera',
  employerName: 'Central Valley Logistics',
  workerContext: `--- O3S_WORKER_STORY ---
I was not paid for all hours worked and raised concerns with HR before I was terminated.
--- O3S_WORKER_STORY_END ---

--- O3S_STORY_FOLLOWUP ---
employment_name:Alex Rivera
employer:Central Valley Logistics
employment_dates:March 2021 through February 2026
key_people:Maria Santos (HR), James Chen (Supervisor)
complained_or_reported:I reported overtime and reimbursement concerns to management and HR in 2025.
changed_afterward:I was removed from projects, excluded from meetings, placed on a PIP, and later terminated.
--- O3S_STORY_FOLLOWUP_END ---`,
  overview: '',
  timelineSummary: '',
  timelineEvents: [
    {
      date: 'March 2021',
      title: 'Offer letter materials',
      category: 'Offer Letters',
      summary: 'References: offer_letter.pdf',
    },
    {
      date: 'January 2026',
      title: 'Separation notice materials',
      category: 'HR Documents',
      summary: 'References: termination_letter.pdf',
    },
    {
      date: 'Date unclear — review source document',
      title: 'Workplace complaint materials',
      category: 'Workplace Communications',
      summary: 'HR complaint correspondence.',
    },
  ],
  categories: ['Pay Records', 'Offer Letters', 'HR Documents'],
  categoryBreakdown: [
    { name: 'Pay Records', count: 2 },
    { name: 'Offer Letters', count: 1 },
    { name: 'HR Documents', count: 1 },
  ],
  uploadedFileInventory: [
    { fileName: 'offer_letter.pdf', category: 'Offer Letters' },
    { fileName: 'termination_letter.pdf', category: 'HR Documents' },
    { fileName: 'performance_review.pdf', category: 'Performance Reviews' },
    { fileName: 'paystub_march.pdf', category: 'Pay Records' },
    { fileName: 'hr_complaint_email.pdf', category: 'Workplace Communications' },
  ],
  documentsUploaded: 5,
  readiness: [],
  missing: ['This may help clarify reimbursement receipts from this date range.'],
  disclaimer: 'Not legal advice.',
};

describe('packetStoryPresentation V2', () => {
  test('executive summary uses natural narrative without awkward openers', () => {
    const summary = buildExecutiveSummary(BASE);
    expect(summary).toMatch(/^Worker reports employment with Central Valley Logistics from March 2021 through February 2026/i);
    expect(summary).toMatch(/describes concerns involving/i);
    expect(summary).not.toMatch(/Worker reports concerns regarding/i);
    expect(summary).toMatch(/According to their account/i);
    expect(summary).toMatch(/Records currently reflect/i);
    expect(summary).not.toMatch(/organized and connected to a developing chronology/i);
  });

  test('executive summary reflects story, record support, sequence, people, and date conflicts', () => {
    const summary = buildExecutiveSummary({
      ...BASE,
      workerName: 'Jordan Lee',
      employerName: 'Acme Logistics',
      documentsUploaded: 20,
      workerContext: `--- O3S_WORKER_STORY ---
I worked for Acme Logistics. I was asked to answer messages off the clock, missed breaks when staffing was short, raised safety and staffing concerns, asked about reimbursement for my work phone and internet, had schedule changes afterward, received a written warning, was placed on a PIP, and was terminated.
--- O3S_WORKER_STORY_END ---

--- O3S_STORY_FOLLOWUP ---
employment_name:Jordan Lee
employer:Acme Logistics
employment_dates:March 2022 through January 2025
key_people:Ashley Kim (Human Resources), Michael Reed (Operations Manager), David Lopez (Witness)
complained_or_reported:I complained to management and HR in March 2024 about unpaid work time, missed breaks, staffing, safety, and reimbursement.
changed_afterward:My schedule changed, I received a written warning, my performance review changed, I was placed on a PIP, and I later received separation documentation.
--- O3S_STORY_FOLLOWUP_END ---`,
      timelineEvents: [
        {
          date: 'March 15, 2021',
          title: 'Employment begins',
          category: 'Offer Letters',
          summary: 'References: offer_letter.pdf',
          sourceDates: ['March 15, 2021'],
        },
        {
          date: 'March 2024',
          title: 'Complaint submitted to Human Resources',
          category: 'Workplace Communications',
          summary: 'Worker reports complaint to HR and management. References: Complaint_To_HR.pdf',
        },
        {
          date: 'April 2024',
          title: 'Schedule change documented',
          category: 'Time Records',
          summary: 'References: schedule_change_timesheet.pdf',
        },
        {
          date: 'August 2024',
          title: 'Written warning issued',
          category: 'HR Documents',
          summary: 'References: Written_Warning.pdf',
        },
        {
          date: 'October 2024',
          title: 'Performance review and PIP documented',
          category: 'Performance Reviews',
          summary: 'References: Performance_Review_PIP.pdf',
        },
        {
          date: 'January 2025',
          title: 'Termination documented',
          category: 'HR Documents',
          summary: 'References: Termination_Letter.pdf',
        },
        {
          date: 'February 11, 2026',
          title: 'Separation benefits record',
          category: 'HR Documents',
          summary: 'References: separation_benefits.pdf',
          sourceDates: ['February 11, 2026'],
        },
      ],
      uploadedFileInventory: [
        { fileName: 'Complaint_To_HR.pdf', category: 'Workplace Communications' },
        { fileName: 'payroll_march_2024.pdf', category: 'Pay Records' },
        { fileName: 'schedule_change_timesheet.pdf', category: 'Time Records' },
        { fileName: 'Written_Warning.pdf', category: 'HR Documents' },
        { fileName: 'Performance_Review_PIP.pdf', category: 'Performance Reviews' },
        { fileName: 'Termination_Letter.pdf', category: 'HR Documents' },
        { fileName: 'Witness_Statement_David_Lopez.pdf', category: 'HR Documents' },
        { fileName: 'Reimbursement_phone_internet.pdf', category: 'Reimbursement Records' },
      ],
      categories: ['Pay Records', 'Time Records', 'HR Documents', 'Performance Reviews', 'Workplace Communications'],
      categoryBreakdown: [],
    });

    expect(summary).toMatch(/Acme Logistics/i);
    expect(summary).toMatch(/off-the-clock work/i);
    expect(summary).toMatch(/missed breaks/i);
    expect(summary).toMatch(/safety or staffing concerns/i);
    expect(summary).toMatch(/reimbursement issues/i);
    expect(summary).toMatch(/scheduling records/i);
    expect(summary).toMatch(/discipline or performance review changes/i);
    expect(summary).toMatch(/termination or separation/i);
    expect(summary).toMatch(/^Worker reports/i);
    expect(summary).toMatch(/Records currently reflect/i);
    expect(summary).toMatch(/complaints or communications with management and Human Resources/i);
    expect(summary).toMatch(/payroll and timekeeping records/i);
    expect(summary).toMatch(/disciplinary records/i);
    expect(summary).toMatch(/performance-related records/i);
    expect(summary).toMatch(/witness statements/i);
    expect(summary).toMatch(/separation documents/i);
    expect(summary).toMatch(/timeline currently places worker-raised concerns before later workplace action records/i);
    expect(summary).toMatch(/Ashley Kim .*Human Resources/i);
    expect(summary).toMatch(/What remains unclear:/i);
    expect(summary).toMatch(/Some date details may require confirmation/i);
    expect(summary).not.toMatch(/\b(retaliation|wrongful termination|violation|strong case|weak case)\b/i);
  });

  test('case snapshot uses role evidence instead of showing zero named individuals', () => {
    const payload: IntakeSummaryDownloadPayload = {
      ...BASE,
      workerContext: `--- O3S_WORKER_STORY ---
I raised workplace concerns with HR, management, and my supervisor. A coworker later provided a witness statement.
--- O3S_WORKER_STORY_END ---

--- O3S_STORY_FOLLOWUP ---
employment_name:Jordan Lee
employer:Acme Logistics
employment_dates:March 2022 through January 2025
complained_or_reported:I complained to HR and management in 2024.
changed_afterward:My schedule changed and I later received separation documents.
--- O3S_STORY_FOLLOWUP_END ---`,
      orgSections: {
        executive_summary: '',
        chronology: [],
        people_and_entities: [],
        supporting_records: [],
        potential_gaps: [],
        clarification_items: [],
        review_notes: [],
        disclaimer: 'Not legal advice.',
      },
      timelineEvents: [
        {
          date: 'March 15, 2021',
          title: 'Employment begins',
          category: 'Offer Letters',
          summary: 'References: offer_letter.pdf',
          sourceDates: ['March 15, 2021'],
        },
        {
          date: 'February 11, 2026',
          title: 'Separation benefits record',
          category: 'HR Documents',
          summary: 'References: separation_benefits.pdf',
          sourceDates: ['February 11, 2026'],
        },
      ],
      uploadedFileInventory: [
        { fileName: 'HR_Complaint.pdf', category: 'Workplace Communications' },
        { fileName: 'Manager_Response.pdf', category: 'Workplace Communications' },
        { fileName: 'Supervisor_Schedule_Change.pdf', category: 'Time Records' },
        { fileName: 'Witness_Statement.pdf', category: 'HR Documents' },
      ],
    };

    const vm = buildIntakePacketViewModel(payload);
    expect(vm.caseSnapshot.namedIndividuals).toBeGreaterThan(0);
    expect(vm.caseSnapshot.primaryConcerns).toContain('Date details may require confirmation');

    const html = buildIntakePacketHtml(payload);
    expect(html).not.toContain('<dt>Named Individuals</dt><dd>0</dd>');

    const pdfLines = collectIntakePacketPdfLines(payload);
    expect(pdfLines.join('\n')).not.toContain('Named Individuals: 0');
  });

  test('executive summary prefers existing sequence-aware intelligence when available', () => {
    const summary = buildExecutiveSummary({
      ...BASE,
      orgSections: {
        executive_summary:
          'The chronology currently reflects worker-raised concerns during 2024, followed by later workplace records including schedule communications, a written warning, and separation documentation.',
        chronology: [],
        people_and_entities: [],
        supporting_records: [],
        potential_gaps: [],
        clarification_items: [],
        review_notes: [],
        disclaimer: 'Not legal advice.',
      },
    });

    expect(summary).toMatch(/chronology currently reflects worker-raised concerns during 2024/i);
    expect(summary).not.toMatch(/organized and connected to a developing chronology/i);
  });

  test('executive summary adds unclear review-preparation language from missing records', () => {
    const summary = buildExecutiveSummary({
      ...BASE,
      missing: [
        'Manager response or follow-up after the reported concern',
        'Additional timekeeping or schedule records for comparison',
      ],
    });

    expect(summary).toMatch(/What remains unclear:/i);
    // Missing-record items are joined into a single "may help complete the timeline" clause.
    expect(summary).toMatch(/Manager response or follow-up after the reported concern/i);
    expect(summary).toMatch(/Additional timekeeping or schedule records for comparison may help complete the timeline/i);
    expect(summary).not.toMatch(/\b(retaliation occurred|discrimination occurred|wrongful termination|liability|settlement value|strong case|weak case|likely illegal)\b/i);
  });

  test('executive summary sparse fallback remains neutral and review-only', () => {
    const summary = buildExecutiveSummary({
      ...BASE,
      workerName: '',
      employerName: '',
      workerContext: '',
      overview: '',
      timelineSummary: '',
      timelineEvents: [],
      categories: [],
      categoryBreakdown: [],
      uploadedFileInventory: [],
      documentsUploaded: 0,
      missing: [],
    });

    expect(summary).toBe('Worker reports and available records are organized for review preparation only.');
    expect(summary).not.toMatch(/\b(retaliation|discrimination|wrongful termination|violation|liability|strong case|weak case|outcome|should sue|hire an attorney)\b/i);
  });

  test('PDF chronology lines clean legacy generic labels from structured sections', () => {
    const lines = collectIntakePacketPdfLines({
      ...BASE,
      orgSections: {
        executive_summary: '',
        chronology: ['Payroll period documented', 'HR record documented', 'Workplace record documented'],
        people_and_entities: [],
        supporting_records: [],
        potential_gaps: [],
        clarification_items: [],
        review_notes: [],
        disclaimer: 'Not legal advice.',
      },
    });

    expect(lines.join('\n')).toContain('Employment activity documented through payroll records');
    expect(lines.join('\n')).toContain('Human Resources communication documented');
    expect(lines.join('\n')).toContain('Workplace concern documented');
    expect(lines.join('\n')).not.toContain('Payroll period documented');
    expect(lines.join('\n')).not.toContain('HR record documented');
    expect(lines.join('\n')).not.toContain('Workplace record documented');
  });

  test('worker account preserves worker voice in structured sections', () => {
    const account = buildWorkerAccount(BASE);
    expect(account.sections.some((s) => s.heading === 'Concerns Reported')).toBe(true);
    expect(account.sections.some((s) => s.heading === 'Events After Concerns Were Raised')).toBe(true);
    expect(account.sections.some((s) => s.heading === 'People Identified By Worker')).toBe(true);
    expect(account.narrative).toMatch(/reported overtime/i);
  });

  test('chronology titles and dates are attorney-readable', () => {
    expect(
      presentPacketTimelineStoryTitle(
        { date: 'March 2021', title: 'Offer letter materials', category: 'Offer Letters', summary: '' },
        0
      )
    ).toBe('Employment begins');
    expect(
      presentPacketTimelineStoryTitle(
        { date: 'Jan 2026', title: 'Separation notice materials', category: 'HR Documents', summary: '' },
        2
      )
    ).toMatch(/Employment ends|Termination documented/);
    expect(
      presentPacketTimelineStoryTitle(
        { date: 'Date unclear — review source document', title: 'Workplace complaint materials', category: 'Workplace Communications', summary: 'Complaint_To_HR' },
        1
      )
    ).toBe('Complaint submitted to Human Resources');
    expect(presentPacketEventDate('Date unclear — review source document', 'HR complaint')).toBe(
      'Date not yet clear'
    );
  });

  test('supporting records favor direct relevance', () => {
    const picks = pickSupportingRecordsForEvent(
      'Employment begins',
      {
        date: 'March 2021',
        title: 'Offer letter materials',
        category: 'Offer Letters',
        summary: 'References: offer_letter.pdf',
      },
      BASE.uploadedFileInventory ?? []
    );
    expect(picks.some((p) => /offer_letter/i.test(p))).toBe(true);
    expect(picks.some((p) => /performance_review/i.test(p))).toBe(false);
  });
});

describe('story-first packet presentation', () => {
  test('view model includes case snapshot and humanized chronology', () => {
    const vm = buildIntakePacketViewModel(BASE);
    expect(vm.caseSnapshot.recordsOrganized).toBe(5);
    expect(vm.caseSnapshot.primaryConcerns.length).toBeGreaterThan(0);
    expect(vm.chronologyEvents[0]?.title).toBe('Employment begins');
    expect(vm.chronologyEvents[1]?.title).toMatch(/Employment ends|Termination documented/);
    expect(vm.chronologyEvents[2]?.title).toBe('Complaint submitted to Human Resources');
    expect(vm.reviewSignals.some((s) => s.label.includes('Payroll & Compensation'))).toBe(true);
  });

  test('html export uses V2 story packet structure', () => {
    const html = buildIntakePacketHtml(BASE);
    expect(html).toContain(ATTORNEY_PACKET_SECTIONS.currentUnderstanding);
    expect(html).toContain(ATTORNEY_PACKET_SECTIONS.caseSnapshot);
    expect(html).toContain(ATTORNEY_PACKET_SECTIONS.workerStory);
    expect(html).toContain('Concerns Reported');
    expect(html).toContain(ATTORNEY_PACKET_SECTIONS.chronology);
    expect(html).not.toContain('Worker Narrative');
    expect(html).not.toContain('Event documented in uploaded records');
  });
});
