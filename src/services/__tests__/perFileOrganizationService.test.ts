import { describe, expect, test } from 'vitest';
import { buildPerFileOrganizationRecords } from '../perFileOrganizationService';
import type { DocumentGroundedFileInput } from '../intakeOrganizationTypes';

// Real document_facts captured live from the actual extraction pipeline for the Marcus Delgado
// case (2026-08-18 founder review) -- a worker's overtime complaint email and HR's reply.
const complaintEmail: DocumentGroundedFileInput = {
  uploadedFileId: 'f02',
  fileName: '02-email-overtime-complaint.pdf',
  category: 'Workplace Communications',
  extractedText: 'placeholder',
  documentFacts: {
    category: 'Workplace Communications',
    file_name: '02-email-overtime-complaint.pdf',
    complaint_topic: 'Overtime hours not being paid correctly',
    resolution_summary: null,
    relationship_to_worker: null,
    issued_by: null,
    people_mentioned: ['Marcus Delgado', 'Renee Ashford'],
    communication_parties: [
      { name: 'Marcus Delgado', role: 'sender' },
      { name: 'Renee Ashford', role: 'recipient' },
    ],
  } as any,
};

const hrReply: DocumentGroundedFileInput = {
  uploadedFileId: 'f03',
  fileName: '03-hr-reply.pdf',
  category: 'HR Documents',
  extractedText: 'placeholder',
  documentFacts: {
    category: 'HR Documents',
    file_name: '03-hr-reply.pdf',
    complaint_topic: 'Overtime hours not being paid correctly',
    resolution_summary:
      'We received your email and are looking into your concerns about overtime pay. I have forwarded this to payroll and will follow up once I hear back.',
    relationship_to_worker: 'HR Manager',
    issued_by: 'Renee Ashford',
    people_mentioned: ['Marcus Delgado', 'Renee Ashford'],
    communication_parties: [
      { name: 'Renee Ashford', role: 'sender' },
      { name: 'Marcus Delgado', role: 'recipient' },
    ],
  } as any,
};

describe('buildPossibleTimelineEvent — event semantics from document_facts (2026-08-18 founder review)', () => {
  test('titles an HR reply specifically, using resolution_summary in the summary detail, even though the file has no relationship_to_worker on its own recipient field', () => {
    const { fileRecords } = buildPerFileOrganizationRecords(
      [{ uploadedFileId: 'f03', fileName: hrReply.fileName, category: hrReply.category }],
      [hrReply]
    );
    const event = fileRecords[0]?.possible_timeline_event;
    expect(event?.title).toBe('HR response received regarding Overtime hours not being paid correctly');
    expect(event?.neutral_summary).toMatch(/forwarded this to payroll/i);
  });

  test('cross-document reasoning: an outgoing complaint with no role info of its own still resolves to HR when the SAME recipient is confirmed HR on another file in the intake', () => {
    // 02's own document_facts never states Renee's role (relationship_to_worker is null on that
    // file) -- only 03 (a different file) states it. deriveNamedPeopleForIntake aggregates
    // across the whole intake, so 02's title still correctly resolves once both files are present.
    const { fileRecords } = buildPerFileOrganizationRecords(
      [
        { uploadedFileId: 'f02', fileName: complaintEmail.fileName, category: complaintEmail.category },
        { uploadedFileId: 'f03', fileName: hrReply.fileName, category: hrReply.category },
      ],
      [complaintEmail, hrReply]
    );
    const complaintRecord = fileRecords.find((r) => r.file_name === complaintEmail.fileName);
    expect(complaintRecord?.possible_timeline_event?.title).toBe(
      'Complaint submitted to Human Resources regarding Overtime hours not being paid correctly'
    );
    expect(complaintRecord?.possible_timeline_event?.title).not.toMatch(/Workplace communications|Supporting employment records/i);
  });

  test('does not apply a communication title to a document with no complaint_topic/resolution_summary', () => {
    const offerLetter: DocumentGroundedFileInput = {
      uploadedFileId: 'f01',
      fileName: '01-offer-letter.pdf',
      category: 'Offer Letters',
      extractedText: 'placeholder',
      documentFacts: {
        category: 'Offer Letters',
        file_name: '01-offer-letter.pdf',
        complaint_topic: null,
        resolution_summary: null,
        relationship_to_worker: null,
        issued_by: 'Renee Ashford',
        people_mentioned: ['Marcus Delgado'],
        communication_parties: [],
      } as any,
    };
    const { fileRecords } = buildPerFileOrganizationRecords(
      [{ uploadedFileId: 'f01', fileName: offerLetter.fileName, category: offerLetter.category }],
      [offerLetter]
    );
    expect(fileRecords[0]?.possible_timeline_event?.title).not.toMatch(/Complaint submitted|HR response/);
  });
});
