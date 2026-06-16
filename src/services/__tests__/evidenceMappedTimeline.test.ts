import { describe, expect, test } from 'vitest';
import { DATE_UNCLEAR_LABEL } from '../contextualDateClassification';
import { buildDocumentGroundedOrganization } from '../documentGroundedOrganizationService';
import { buildPlaceholderOrganization } from '../aiOrganizationService';
import {
  buildEvidenceMappedTimelineEvents,
  evidenceTimelineToOrganizationEvents,
} from '../evidenceMappedTimelineService';
import { buildIntakeOrganizationSections, refreshSectionsReviewNotes } from '../intakeOrganizationSectionsService';
import { applyEvidenceMappedOrganization } from '../intakeOrganizationEngine';
import { assertNeutralOrganizationOutput } from '../intakeOrganizationAssertions';
import { collectOrganizedSectionsPdfLines } from '../intakePacketPresentation';
import { ATTORNEY_PACKET_SECTIONS } from '../../app/constants/workerStoryIntake';
import type { IntakeFileOrganizationRecord } from '../intakeOrganizationTypes';

const PAY_TEXT = `
PAY STUB
Pay period: March 1 – March 15, 2024
Gross pay: $2,400.00
Employee: Alex Rivera
Employer: Acme Logistics
`;

const HR_TEXT = `
From: Jane Smith
To: HR Department
Date: March 4, 2025
Subject: Workplace concern
I reported scheduling issues and would like HR to review.
`;

function sampleFileRecord(overrides: Partial<IntakeFileOrganizationRecord>): IntakeFileOrganizationRecord {
  return {
    source_file_id: 'f1',
    file_name: 'file.pdf',
    document_type: 'Workplace Communications',
    legacy_upload_category: 'Workplace Communications',
    likely_date: 'March 4, 2025',
    people_or_entities: ['Jane Smith', 'HR Department'],
    employment_topics: ['Workplace communications'],
    possible_timeline_event: {
      title: 'Workplace communications',
      date: 'March 4, 2025',
      neutral_summary: 'Materials may reflect workplace communications.',
    },
    supporting_record_strength: 'strong',
    missing_or_unclear_information: [],
    confidence: 'high',
    extraction_quality: 'high',
    ...overrides,
  };
}

describe('evidence-mapped timeline engine', () => {
  test('uses concrete event labels when story and filenames imply an HR complaint followed by termination', () => {
    const fileRecords: IntakeFileOrganizationRecord[] = [
      sampleFileRecord({
        source_file_id: 'complaint-1',
        file_name: 'Complaint_To_HR.pdf',
        document_type: 'Workplace Communications',
        legacy_upload_category: 'Workplace Communications',
        likely_date: 'March 2024',
        employment_topics: ['Workplace communications', 'Complaint'],
        possible_timeline_event: {
          title: 'Workplace complaint materials',
          date: 'March 2024',
          neutral_summary:
            'Worker story: I complained to HR and was terminated months later.',
        },
      }),
      sampleFileRecord({
        source_file_id: 'termination-1',
        file_name: 'Termination_Letter.pdf',
        document_type: 'HR Documents',
        legacy_upload_category: 'HR Documents',
        likely_date: 'June 2024',
        employment_topics: ['Separation', 'Final pay'],
        possible_timeline_event: {
          title: 'Separation notice materials',
          date: 'June 2024',
          neutral_summary:
            'Worker story: I complained to HR and was terminated months later.',
        },
      }),
    ];

    const events = buildEvidenceMappedTimelineEvents({ fileRecords });

    expect(events.map((event) => event.title)).toEqual([
      'Complaint submitted to Human Resources',
      'Termination documented',
    ]);
    expect(events[0]?.supporting_file_names).toEqual(['Complaint_To_HR.pdf']);
    expect(events[1]?.supporting_file_names).toEqual(['Termination_Letter.pdf']);
    expect(events.map((event) => event.title)).not.toEqual(
      expect.arrayContaining(['HR materials', 'Separation materials'])
    );
  });

  test('uses workplace-event labels for safety concerns, performance actions, and scheduling records', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'safety-1',
          file_name: 'Safety_Concern_Email.pdf',
          likely_date: 'January 2024',
          employment_topics: ['Safety concerns', 'Workplace communications'],
        }),
        sampleFileRecord({
          source_file_id: 'review-1',
          file_name: 'Performance_Review.pdf',
          likely_date: 'February 2024',
          document_type: 'Performance Reviews',
          employment_topics: ['Performance concerns'],
        }),
        sampleFileRecord({
          source_file_id: 'schedule-1',
          file_name: 'Schedule_Change.pdf',
          likely_date: 'March 2024',
          document_type: 'Time Records',
          employment_topics: ['Scheduling concerns'],
        }),
      ],
    });

    expect(events.map((event) => event.title)).toEqual([
      'Worker raises safety concerns',
      'Performance review completed',
      'Schedule change documented',
    ]);
  });

  test('normalizes payroll material fallback titles to event-style payroll labels', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'pay-materials-1',
          file_name: 'March_2024_Record.pdf',
          document_type: 'Supporting Records',
          legacy_upload_category: 'Supporting Records',
          employment_topics: ['Payroll and wage records'],
          possible_timeline_event: {
            title: 'Pay period record materials',
            date: 'March 2024',
            neutral_summary: 'Payroll materials are available for review.',
          },
        }),
      ],
    });

    expect(events[0]?.title).toBe('Pay period or overtime record documented');
    expect(events[0]?.title).not.toBe('Pay period record materials');
  });

  test('normalizes HR response material fallback titles to HR response event labels', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'hr-response-1',
          file_name: 'Followup_Response.pdf',
          document_type: 'Workplace Communications',
          legacy_upload_category: 'Workplace Communications',
          employment_topics: ['Human Resources communications'],
          possible_timeline_event: {
            title: 'HR response materials',
            date: 'April 2024',
            neutral_summary: 'Human Resources response materials are available for review.',
          },
        }),
      ],
    });

    expect(events[0]?.title).toBe('HR response received');
    expect(events[0]?.title).not.toBe('HR response materials');
  });

  test('uses separation event labels only when separation material signals are supported', () => {
    const supported = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'separation-1',
          file_name: 'Employment_End_Notice.pdf',
          document_type: 'HR Documents',
          legacy_upload_category: 'HR Documents',
          employment_topics: ['Separation'],
          possible_timeline_event: {
            title: 'Separation notice materials',
            date: 'May 2024',
            neutral_summary: 'Separation notice materials are available for review.',
          },
        }),
      ],
    });

    const unsupported = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'reference-1',
          file_name: 'Reference_Record.pdf',
          document_type: 'Supporting Records',
          legacy_upload_category: 'Supporting Records',
          employment_topics: [],
          possible_timeline_event: {
            title: null,
            date: null,
            neutral_summary: 'General supporting record.',
          },
        }),
      ],
    });

    expect(supported[0]?.title).toBe('Termination documented');
    expect(supported[0]?.title).not.toBe('Separation notice materials');
    expect(unsupported[0]?.title).toBe('Supporting Records');
  });

  test('keeps complaint labels neutral when HR or supervisor signals are not present', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'concern-1',
          file_name: 'Workplace_Concern.pdf',
          document_type: 'Workplace Communications',
          legacy_upload_category: 'Workplace Communications',
          employment_topics: ['Complaint'],
          possible_timeline_event: {
            title: 'Workplace complaint materials',
            date: 'April 2024',
            neutral_summary: 'The worker described a workplace concern.',
          },
        }),
      ],
    });

    expect(events[0]?.title).toBe('Workplace concern documented');
    expect(events[0]?.title).not.toBe('Complaint submitted to Human Resources');
    expect(events[0]?.title).not.toBe('Complaint submitted to supervisor');
  });

  test('event timeline output remains neutral after title normalization', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'normalized-1',
          file_name: 'Termination_Letter.pdf',
          document_type: 'HR Documents',
          legacy_upload_category: 'HR Documents',
          employment_topics: ['Separation'],
          possible_timeline_event: {
            title: 'Separation notice materials',
            date: 'June 2024',
            neutral_summary: 'Separation materials are available for review.',
          },
        }),
      ],
    });

    const output = `${events[0]?.title ?? ''} ${events[0]?.neutral_summary ?? ''}`.toLowerCase();
    expect(output).not.toMatch(/retaliation|discrimination|wrongful termination|strong case|weak case|liability|likely illegal|should sue|settlement value/);
  });

  test('clusters related files by date and topic', () => {
    const fileRecords: IntakeFileOrganizationRecord[] = [
      sampleFileRecord({
        source_file_id: 'hr1',
        file_name: 'HR_Complaint.pdf',
        employment_topics: ['Workplace communications'],
      }),
      sampleFileRecord({
        source_file_id: 'shot1',
        file_name: 'Screenshot_4.png',
        document_type: 'Additional Supporting Records',
        legacy_upload_category: 'Uncategorized',
        employment_topics: ['Workplace communications'],
      }),
    ];

    const events = buildEvidenceMappedTimelineEvents({ fileRecords });
    expect(events.length).toBe(1);
    expect(events[0]?.supporting_file_names).toEqual(
      expect.arrayContaining(['HR_Complaint.pdf', 'Screenshot_4.png'])
    );
    expect(events[0]?.people_involved).toEqual(
      expect.arrayContaining([
        'Jane Smith (Human Resources Representative)',
        'HR Department (Human Resources Representative)',
      ])
    );
    expect(events[0]?.related_topics).toContain('Workplace communications');
    expect(events[0]?.confidence).toBe('high');
  });

  test('derives cluster date from filename when likely_date and possible_timeline_event.date are empty', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'warn-1',
          file_name: 'Written_Warning_August_2024.pdf',
          likely_date: null,
          possible_timeline_event: {
            title: 'Written warning issued',
            date: null,
            neutral_summary: 'Grouped from file name and category.',
          },
          document_type: 'Performance Reviews',
          legacy_upload_category: 'Performance Reviews',
          employment_topics: ['Performance concerns'],
        }),
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.date).toBe('August 2024');
    expect(events[0]?.date).not.toBe(DATE_UNCLEAR_LABEL);
  });

  test('derives cluster date from month_year underscore filenames (paystub pattern)', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'pay-1',
          file_name: 'paystub_march_2024.pdf',
          likely_date: null,
          possible_timeline_event: {
            title: 'Pay period or overtime record documented',
            date: null,
            neutral_summary: 'Grouped from file name and category.',
          },
          document_type: 'Pay Records',
          legacy_upload_category: 'Pay Records',
          employment_topics: ['Payroll and wage records'],
        }),
      ],
    });

    expect(events[0]?.date).toMatch(/^march 2024$/i);
  });

  test('keeps DATE_UNCLEAR_LABEL when filename has no plausible employment date token', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'w-1',
          file_name: 'Written_Warning.pdf',
          likely_date: null,
          possible_timeline_event: {
            title: 'Written warning issued',
            date: null,
            neutral_summary: 'Grouped from file name and category.',
          },
          document_type: 'Performance Reviews',
          legacy_upload_category: 'Performance Reviews',
          employment_topics: ['Performance concerns'],
        }),
        sampleFileRecord({
          source_file_id: 'witness-1',
          file_name: 'Witness_Statement_David_Lopez.pdf',
          likely_date: null,
          possible_timeline_event: {
            title: 'Witness statement provided',
            date: null,
            neutral_summary: 'Grouped from file name and category.',
          },
          document_type: 'Workplace Communications',
          employment_topics: ['Workplace communications'],
        }),
      ],
    });

    expect(events.map((e) => e.date)).toEqual([DATE_UNCLEAR_LABEL, DATE_UNCLEAR_LABEL]);
  });

  test('prefers likely_date over filename-derived date', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'term-1',
          file_name: 'Termination_Letter_January_2025.pdf',
          likely_date: 'June 2024',
          possible_timeline_event: {
            title: 'Termination documented',
            date: null,
            neutral_summary: 'Separation notice materials.',
          },
          document_type: 'HR Documents',
          employment_topics: ['Separation'],
        }),
      ],
    });

    expect(events[0]?.date).toBe('June 2024');
  });

  test('does not treat arbitrary numeric filename prefixes as dates', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        sampleFileRecord({
          source_file_id: 'removal-1',
          file_name: '15_Project_Removal_Notice.pdf',
          likely_date: null,
          possible_timeline_event: {
            title: 'Project removal documented',
            date: null,
            neutral_summary: 'Grouped from file name and category.',
          },
          document_type: 'HR Documents',
          employment_topics: ['Workplace communications'],
        }),
      ],
    });

    expect(events[0]?.date).toBe(DATE_UNCLEAR_LABEL);
  });

  test('records date uncertainty and missing readable support', () => {
    const fileRecords: IntakeFileOrganizationRecord[] = [
      sampleFileRecord({
        source_file_id: 'u1',
        file_name: 'scan.png',
        likely_date: null,
        possible_timeline_event: {
          title: 'Supporting employment records',
          date: null,
          neutral_summary: 'Grouped from file name and category.',
        },
        extraction_quality: 'unreadable',
        confidence: 'low',
        supporting_record_strength: 'inferred',
        people_or_entities: [],
        missing_or_unclear_information: ['Readable text was not available from this upload.'],
      }),
    ];
    const events = buildEvidenceMappedTimelineEvents({ fileRecords });
    expect(events[0]?.gaps_or_uncertainties).toEqual(
      expect.arrayContaining([
        'Date may require confirmation from source records.',
        'No related records found yet.',
      ])
    );
  });

  test('grounded organization emits evidence timeline and sections', () => {
    const org = buildDocumentGroundedOrganization(
      [
        { fileName: 'Pay_March.pdf', category: 'Pay Records', uploadedFileId: 'p1' },
        { fileName: 'HR_email.pdf', category: 'Workplace Communications', uploadedFileId: 'h1' },
      ],
      [
        {
          uploadedFileId: 'p1',
          fileName: 'Pay_March.pdf',
          category: 'Pay Records',
          extractedText: PAY_TEXT,
          qualityFlags: null,
        },
        {
          uploadedFileId: 'h1',
          fileName: 'HR_email.pdf',
          category: 'Workplace Communications',
          extractedText: HR_TEXT,
          qualityFlags: null,
        },
      ],
      null
    );
    expect(org).not.toBeNull();
    if (!org) return;

    expect(org.evidenceTimeline.length).toBeGreaterThan(0);
    expect(org.sections.executive_summary.length).toBeGreaterThan(10);
    expect(org.sections.chronology.length).toBe(org.evidenceTimeline.length);
    expect(org.sections.disclaimer.length).toBeGreaterThan(10);
    expect(() => assertNeutralOrganizationOutput(org)).not.toThrow();

    const dbEvents = evidenceTimelineToOrganizationEvents(org.evidenceTimeline);
    expect(dbEvents[0]?.source.sourceFileNames.length).toBeGreaterThan(0);
  });

  test('structured sections render in packet export order', () => {
    const org = applyEvidenceMappedOrganization({
      fileRecords: [
        sampleFileRecord({ source_file_id: 'a', file_name: 'HR_Complaint.pdf' }),
      ],
      peopleIndex: ['Jane Smith', 'HR Department'],
      executiveLead: 'Uploaded records indicate materials grouped for review.',
      missingDocumentSuggestions: [],
      readinessIndicators: ['Materials grouped for review.'],
      reviewItems: [],
      docTotal: 1,
    });

    const sections = buildIntakeOrganizationSections({
      fileRecords: org.evidenceTimeline.length
        ? [sampleFileRecord({ source_file_id: 'a', file_name: 'HR_Complaint.pdf' })]
        : [],
      peopleIndex: ['Jane Smith'],
      evidenceTimeline: org.evidenceTimeline,
      executiveLead: 'Summary lead.',
      missingDocumentSuggestions: [],
      readinessIndicators: [],
      reviewItems: [],
      docTotal: 1,
    });

    const lines = collectOrganizedSectionsPdfLines({
      intakeNumber: 'EMP-001',
      overview: '—',
      timelineSummary: '—',
      categories: [],
      readiness: [],
      missing: [],
      disclaimer: sections.disclaimer,
      orgSections: sections,
    });

    expect(lines).not.toBeNull();
    const text = (lines ?? []).join('\n');
    expect(text.indexOf(ATTORNEY_PACKET_SECTIONS.currentUnderstanding)).toBeLessThan(
      text.indexOf(ATTORNEY_PACKET_SECTIONS.chronology)
    );
    expect(text.indexOf(ATTORNEY_PACKET_SECTIONS.chronology)).toBeLessThan(text.indexOf('Supporting Documents'));
    expect(text.indexOf('Supporting Documents')).toBeLessThan(
      text.indexOf(ATTORNEY_PACKET_SECTIONS.missingInformation)
    );
    expect(text.indexOf(ATTORNEY_PACKET_SECTIONS.missingInformation)).toBeLessThan(
      text.indexOf(ATTORNEY_PACKET_SECTIONS.disclaimer)
    );
  });

  test('placeholder organization includes sections and evidence timeline', () => {
    const org = buildPlaceholderOrganization([
      { fileName: 'offer.pdf', category: 'Offer Letters', uploadedFileId: 'o1' },
    ]);
    expect(org.evidenceTimeline.length).toBeGreaterThan(0);
    expect(org.sections.chronology.length).toBeGreaterThan(0);
    expect(() => assertNeutralOrganizationOutput(org)).not.toThrow();
  });

  test('refreshSectionsReviewNotes uses final readiness indicators', () => {
    const org = buildPlaceholderOrganization([
      { fileName: 'pay.pdf', category: 'Pay Records', uploadedFileId: 'p1' },
    ]);
    const payDigestLine = 'Available records show pay period wording in Pay_March.pdf.';
    const refreshed = refreshSectionsReviewNotes(org.sections, [payDigestLine], org.reviewItems);
    expect(refreshed.review_notes).toContain(payDigestLine);
    expect(refreshed.executive_summary).toBe(org.sections.executive_summary);
  });
});
