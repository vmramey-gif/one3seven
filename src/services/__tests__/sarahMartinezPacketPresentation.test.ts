import { describe, expect, test } from 'vitest';
import { ATTORNEY_PACKET_SECTIONS } from '../../app/constants/workerStoryIntake';
import { DATE_UNCLEAR_LABEL } from '../contextualDateClassification';
import { buildIntakePacketHtml, buildIntakePacketViewModel } from '../intakePacketPresentation';
import {
  attorneyCategoryLabel,
  buildCaseSnapshot,
  buildExecutiveSummary,
  buildPacketChronologyPresentation,
  mapWorkerDashboardTimelineRows,
} from '../packetStoryPresentation';
import { resolveAttorneyFacingUploadCategory } from '../intakeDataService';
import { inferInventoryCategory } from '../packetChronologyIntelligence';
import type { IntakeSummaryDownloadPayload } from '../intakeSummaryDownload';

export const SARAH_MARTINEZ_FIXTURE: IntakeSummaryDownloadPayload = {
  intakeNumber: 'INT-SARAH-2019',
  workerName: 'Sarah Martinez',
  employerName: 'Regional Medical Group',
  intakeStatus: 'Submitted',
  workerContext: `--- O3S_WORKER_STORY ---
I raised concerns about scheduling and was later terminated.
--- O3S_WORKER_STORY_END ---

--- O3S_STORY_FOLLOWUP ---
employment_name:Sarah Martinez
employer:Regional Medical Group
employment_dates:January 2019 through March 2024
complained_or_reported:I reported scheduling concerns to HR in late 2023.
changed_afterward:I received a written warning, was removed from a project, and was terminated in March 2024.
--- O3S_STORY_FOLLOWUP_END ---`,
  overview: '',
  timelineSummary: '',
  timelineEvents: [
    {
      date: 'January 2019',
      title: 'Offer letter materials',
      category: 'Offer Letters',
      summary: 'References: 01_Offer_Letter.pdf',
    },
    {
      date: 'March 2024',
      title: 'Separation notice materials',
      category: 'HR Documents',
      summary: 'References: 19_Termination_Letter.pdf, 20_Separation_Benefits_Packet.pdf',
    },
    {
      date: DATE_UNCLEAR_LABEL,
      title: 'Workplace complaint materials',
      category: 'Uncategorized',
      summary: 'References: 12_Complaint_To_HR.pdf',
    },
  ],
  categories: ['Offer Letters', 'HR Documents'],
  categoryBreakdown: [],
  uploadedFileInventory: [
    { fileName: '01_Offer_Letter.pdf', category: 'Uncategorized' },
    { fileName: '15_Project_Removal_Notice.pdf', category: 'Uncategorized' },
    { fileName: '12_Complaint_To_HR.pdf', category: 'Uncategorized' },
    { fileName: '19_Termination_Letter.pdf', category: 'Uncategorized' },
    { fileName: '20_Separation_Benefits_Packet.pdf', category: 'Uncategorized' },
    { fileName: '08_Payroll_Report_March_2024.pdf', category: 'Uncategorized' },
  ],
  documentsUploaded: 6,
  readiness: [],
  missing: [],
  disclaimer: 'Not legal advice.',
};

describe('Sarah Martinez packet presentation regression', () => {
  test('preview and PDF include V2 story packet sections', () => {
    const vm = buildIntakePacketViewModel(SARAH_MARTINEZ_FIXTURE);
    const html = buildIntakePacketHtml(SARAH_MARTINEZ_FIXTURE);

    expect(vm.caseSnapshot.employmentPeriod).toMatch(/January 2019/i);
    expect(vm.humanContext.sections.length).toBeGreaterThan(0);
    expect(vm.chronologyEvents.length).toBeGreaterThan(0);

    expect(html).toContain(ATTORNEY_PACKET_SECTIONS.caseSnapshot);
    expect(html).toContain(ATTORNEY_PACKET_SECTIONS.workerStory);
    expect(html).toContain(ATTORNEY_PACKET_SECTIONS.chronology);
  });

  test('snapshot does not assert a worker-stated period the documents contradict (Elena Marquez regression)', () => {
    // Worker free-text follow-up says employment ended August 2021, but the source-linked
    // documents run to April 2026. The snapshot must flag the divergence, never assert the
    // conflicting worker-stated period as fact.
    const conflicting: IntakeSummaryDownloadPayload = {
      ...SARAH_MARTINEZ_FIXTURE,
      workerContext: `--- O3S_WORKER_STORY ---
I was terminated after raising concerns.
--- O3S_WORKER_STORY_END ---

--- O3S_STORY_FOLLOWUP ---
employer:Acme Co
employment_dates:March 2021 through August 2021
--- O3S_STORY_FOLLOWUP_END ---`,
      timelineEvents: [
        { date: 'March 2021', title: 'Offer letter materials', category: 'Offer Letters', summary: '' },
        { date: 'April 2026', title: 'Separation notice materials', category: 'HR Documents', summary: '' },
      ],
    };
    const snapshot = buildCaseSnapshot(conflicting);
    expect(snapshot.employmentPeriod).toMatch(/worker-stated; not confirmed by records/i);
    expect(snapshot.primaryConcerns.some((c) => /date details may require confirmation/i.test(c))).toBe(true);

    // The clean case (Sarah — dates align) stays a bare, asserted period with no qualifier.
    const clean = buildCaseSnapshot(SARAH_MARTINEZ_FIXTURE);
    expect(clean.employmentPeriod).not.toMatch(/not confirmed by records/i);
  });

  test('falls back to document-derived employer/period when the worker gave no story at all (Marcus Delgado regression, 2026-08-18)', () => {
    // A real upload-only intake (no guided-intake story, no story-followup) whose per-file
    // extraction correctly identified the employer and start/end dates still showed "Not yet
    // identified" / "Not yet confirmed" everywhere -- employerName and documentEmploymentPeriod
    // existed on the payload type and were correctly computed by synthesizeIntakeIntelligence,
    // but nothing wired them into either field. workerContext is empty here specifically to
    // prove neither field depends on a worker-provided story.
    const documentOnly: IntakeSummaryDownloadPayload = {
      ...SARAH_MARTINEZ_FIXTURE,
      workerContext: '',
      employerName: 'Bright Horizon Logistics',
      documentEmploymentPeriod: 'March 17, 2025 – June 24, 2025',
    };
    const snapshot = buildCaseSnapshot(documentOnly);
    expect(snapshot.employmentPeriod).toBe('March 17, 2025 – June 24, 2025 (from records)');

    const summary = buildExecutiveSummary(documentOnly);
    expect(summary).toMatch(/Bright Horizon Logistics/);
  });

  test('a worker-stated employer/period still wins over document-derived fields when both are present', () => {
    // Doctrine: the worker's own account is the primary source; document-derived fields are a
    // fallback for when the worker didn't say, never an override.
    const both: IntakeSummaryDownloadPayload = {
      ...SARAH_MARTINEZ_FIXTURE,
      employerName: 'Bright Horizon Logistics',
      documentEmploymentPeriod: 'March 17, 2025 – June 24, 2025',
    };
    const snapshot = buildCaseSnapshot(both);
    expect(snapshot.employmentPeriod).not.toMatch(/Bright Horizon|from records/i);
    expect(snapshot.employmentPeriod).toMatch(/January 2019/);

    const summary = buildExecutiveSummary(both);
    expect(summary).toMatch(/Regional Medical Group/);
    expect(summary).not.toMatch(/Bright Horizon Logistics/);
  });

  test('no fallback text leaks in when neither a story nor document-derived fields exist', () => {
    const nothing: IntakeSummaryDownloadPayload = {
      ...SARAH_MARTINEZ_FIXTURE,
      workerContext: '',
      employerName: undefined,
      documentEmploymentPeriod: undefined,
    };
    const snapshot = buildCaseSnapshot(nothing);
    expect(snapshot.employmentPeriod).toBe('Not yet confirmed');
  });

  test('employment start uses Employment begins with offer letter only', () => {
    const chronology = buildPacketChronologyPresentation(SARAH_MARTINEZ_FIXTURE);
    const start = chronology.find((e) => e.title === 'Employment begins');
    expect(start).toBeDefined();
    expect(start?.supportingUploads).toHaveLength(1);
    expect(start?.supportingUploads[0]).toMatch(/01_Offer_Letter/i);
    expect(start?.supportingUploads.some((n) => /payroll|project|complaint|termin/i.test(n))).toBe(false);
  });

  test('employment end references termination and separation benefits', () => {
    const chronology = buildPacketChronologyPresentation(SARAH_MARTINEZ_FIXTURE);
    const end = chronology.find((e) => /Employment ends|Termination documented/.test(e.title));
    expect(end).toBeDefined();
    const uploads = end?.supportingUploads ?? [];
    expect(
      uploads.some((n) => /19_Termination_Letter/i.test(n)) || uploads.some((n) => /20_Separation_Benefits/i.test(n))
    ).toBe(true);
  });

  test('dashboard timeline rows match packet chronology presentation', () => {
    const rows = mapWorkerDashboardTimelineRows(SARAH_MARTINEZ_FIXTURE);
    const serialized = JSON.stringify(rows);
    expect(serialized).not.toContain(DATE_UNCLEAR_LABEL);
    expect(serialized).not.toContain('Event documented in uploaded records');
    expect(rows.some((r) => r.event === 'Employment begins')).toBe(true);
    expect(rows.every((r) => r.packetPresentationApplied)).toBe(true);
  });

  test('attorney-facing categories infer from obvious filenames', () => {
    expect(attorneyCategoryLabel(inferInventoryCategory('12_Complaint_To_HR.pdf', 'Uncategorized'), '12_Complaint_To_HR.pdf')).toBe(
      'HR Complaints & Responses'
    );
    expect(resolveAttorneyFacingUploadCategory('Witness_Statement_A.pdf', 'Uncategorized')).toBe('Witness Statements');
    expect(resolveAttorneyFacingUploadCategory('Written_Warning.pdf', 'Uncategorized')).toBe('Disciplinary Materials');
    expect(resolveAttorneyFacingUploadCategory('19_Termination_Letter.pdf', 'Uncategorized')).toBe('Separation Documents');
    expect(resolveAttorneyFacingUploadCategory('20_Separation_Benefits_Packet.pdf', 'Uncategorized')).toBe(
      'Separation Documents'
    );
    expect(resolveAttorneyFacingUploadCategory('15_Project_Removal_Notice.pdf', 'Uncategorized')).toBe('Disciplinary Materials');
    expect(resolveAttorneyFacingUploadCategory('Coaching_Memo.pdf', 'Uncategorized')).toBe('Disciplinary Materials');
  });
});
