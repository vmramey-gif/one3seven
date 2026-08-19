import { describe, expect, test } from 'vitest';
import { buildPerFileOrganizationRecords } from '../perFileOrganizationService';
import type { DocumentGroundedFileInput } from '../intakeOrganizationTypes';
import { scanBannedVocabulary } from '../bannedVocabulary';

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
    // Doctrine scanner against the ACTUAL generated title/summary, not a hand-picked example
    // string (2026-08-18 audit finding) -- communicationTitleFromFacts interpolates an
    // AI-extracted complaint_topic paraphrase directly into a persistent event title, so a
    // looser extraction could reintroduce banned language with nothing catching it today.
    expect(scanBannedVocabulary(event?.title)).toEqual([]);
    expect(scanBannedVocabulary(event?.neutral_summary)).toEqual([]);
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

describe('buildPerFileOrganizationRecords — people-and-entities roster (2026-08-18 founder request)', () => {
  test('a confirmed HR contact from document_facts.relationship_to_worker gets a role label; the worker does not', () => {
    // Renee's role ("HR Manager") is only ever stated explicitly on the REPLY file's own
    // document_facts -- not derivable from either file's possible_timeline_event title/summary
    // strings alone (that weaker, per-file-record signal only carries a bare "HR", which is
    // medium confidence and does not clear the roster's 'high' bar). The roster must read
    // document_facts directly (deriveNamedPeopleForIntake) to resolve this correctly.
    const { peopleIndex } = buildPerFileOrganizationRecords(
      [
        { uploadedFileId: 'f02', fileName: complaintEmail.fileName, category: complaintEmail.category },
        { uploadedFileId: 'f03', fileName: hrReply.fileName, category: hrReply.category },
      ],
      [complaintEmail, hrReply]
    );
    expect(peopleIndex).toContain('Renee Ashford (Human Resources Representative)');
    expect(peopleIndex).toContain('Marcus Delgado');
    expect(peopleIndex).not.toContain('Marcus Delgado (Human Resources Representative)');
  });
});

describe('pay-period range legibility (2026-08-18, document-range vs. employment-period vs. event-chronology split)', () => {
  test('a paystub with pay_period_start/pay_period_end gets the covered range stated in its summary, not just a single anchor date', () => {
    const paystub: DocumentGroundedFileInput = {
      uploadedFileId: 'f1',
      fileName: 'paystub_march_2024.pdf',
      category: 'Compensation & Payroll',
      extractedText: 'PAY STUB\nPay period: March 1 - March 15, 2024\nGross pay: $2,400.00',
      documentFacts: {
        category: 'Compensation & Payroll',
        file_name: 'paystub_march_2024.pdf',
        pay_period_start: 'March 1, 2024',
        pay_period_end: 'March 15, 2024',
      } as any,
    };
    const { fileRecords } = buildPerFileOrganizationRecords(
      [{ uploadedFileId: 'f1', fileName: paystub.fileName, category: paystub.category }],
      [paystub]
    );
    // likely_date stays a single sortable string (unchanged contract for every date-comparison/
    // export consumer) -- the range itself becomes legible in the summary text instead.
    expect(fileRecords[0]?.possible_timeline_event?.neutral_summary).toMatch(
      /covers the pay period March 1, 2024 to March 15, 2024/i
    );
    expect(scanBannedVocabulary(fileRecords[0]?.possible_timeline_event?.neutral_summary)).toEqual([]);
  });

  test('a document with no pay_period_start/pay_period_end gets no range note', () => {
    const offerLetter: DocumentGroundedFileInput = {
      uploadedFileId: 'f1',
      fileName: 'offer_letter.pdf',
      category: 'Offer Letters',
      extractedText: 'OFFER OF EMPLOYMENT',
      documentFacts: {
        category: 'Offer Letters',
        file_name: 'offer_letter.pdf',
        start_date: '2026-03-03',
      } as any,
    };
    const { fileRecords } = buildPerFileOrganizationRecords(
      [{ uploadedFileId: 'f1', fileName: offerLetter.fileName, category: offerLetter.category }],
      [offerLetter]
    );
    expect(fileRecords[0]?.possible_timeline_event?.neutral_summary).not.toMatch(/covers the pay period/i);
  });
});
