import { describe, expect, test } from 'vitest';
import { buildPlaceholderOrganization } from '../aiOrganizationService';
import { buildDocumentGroundedOrganization } from '../documentGroundedOrganizationService';
import { assertNeutralOrganizationOutput } from '../intakeOrganizationAssertions';
import { buildMatterAwareGuidance } from '../matterAwareOrganizationService';
import { buildPerFileOrganizationRecords } from '../perFileOrganizationService';
import type { IntakeFileOrganizationRecord } from '../intakeOrganizationTypes';

const PAY_STUB_TEXT = `
PAY STUB
Pay period: March 1 – March 15, 2024
Gross pay: $2,400.00
Net pay: $1,850.00
Employee: Alex Rivera
`;

function payStubRecord(id: string, name: string): IntakeFileOrganizationRecord {
  const { fileRecords } = buildPerFileOrganizationRecords(
    [{ uploadedFileId: id, fileName: name, category: 'Pay Records' }],
    [
      {
        uploadedFileId: id,
        fileName: name,
        category: 'Pay Records',
        extractedText: PAY_STUB_TEXT,
      },
    ]
  );
  return fileRecords[0]!;
}

describe('matter-aware organization guidance', () => {
  test('wage & hour with many pay stubs does not suggest pay stub uploads', () => {
    const fileRecords = Array.from({ length: 40 }, (_, i) =>
      payStubRecord(`pay-${i}`, `PayStub_${i + 1}.pdf`)
    );

    const guidance = buildMatterAwareGuidance({
      matterTags: ['wage_hour'],
      fileRecords,
      evidenceTimeline: [],
    });

    const combined = [...guidance.potentialGaps, ...guidance.clarificationItems].join('\n');
    expect(combined).not.toMatch(/upload pay stub/i);
    expect(combined).not.toMatch(/No pay stub records were located/i);
    expect(combined).toMatch(/Records mention Wage & Hour/i);
    expect(combined).toMatch(/Pay stubs/i);
    expect(combined).toMatch(/No timesheet records were located|timesheet records/i);
    expect(combined).toMatch(/No scheduling records were located|scheduling records/i);
  });

  test('does not emit matter guidance without employment matter tags', () => {
    const fileRecords = [payStubRecord('p1', 'Pay_March.pdf')];
    const guidance = buildMatterAwareGuidance({
      matterTags: [],
      fileRecords,
      evidenceTimeline: [],
    });
    expect(guidance.potentialGaps).toHaveLength(0);
    expect(guidance.clarificationItems).toHaveLength(0);
  });

  test('other / not sure uses generic clarification only', () => {
    const guidance = buildMatterAwareGuidance({
      matterTags: ['other_not_sure'],
      fileRecords: [payStubRecord('p1', 'Pay_March.pdf')],
      evidenceTimeline: [],
    });
    const combined = [...guidance.potentialGaps, ...guidance.clarificationItems].join('\n');
    expect(combined).toMatch(/Additional records may help complete the topics reflected in this intake/i);
    expect(combined).not.toMatch(/No timesheet records were located/i);
    expect(combined).not.toMatch(/No pay stub records were located/i);
  });

  test('uses soft language when corpus coverage is weak', () => {
    const { fileRecords } = buildPerFileOrganizationRecords([
      { uploadedFileId: 'u1', fileName: 'scan001.pdf', category: 'Uncategorized' },
    ]);
    const guidance = buildMatterAwareGuidance({
      matterTags: ['wage_hour'],
      fileRecords,
      evidenceTimeline: [],
    });
    const combined = [...guidance.potentialGaps, ...guidance.clarificationItems].join('\n');
    expect(combined).not.toMatch(/No timesheets exist/i);
    expect(combined).not.toMatch(/This proves missing documentation/i);
    expect(combined).toMatch(/may not include all|Additional records may help complete/i);
  });

  test('placeholder organization with wage_hour tag passes neutral validation', () => {
    const org = buildPlaceholderOrganization(
      [{ fileName: 'Pay_March.pdf', category: 'Pay Records', uploadedFileId: 'f1' }],
      { employmentMatterTags: ['wage_hour'] }
    );
    expect(() => assertNeutralOrganizationOutput(org)).not.toThrow();
    const gaps = org.sections.potential_gaps.join('\n');
    expect(gaps).not.toMatch(/illegal|liability|strong claim/i);
  });

  test('document-grounded organization includes matter-aware clarification items', () => {
    const org = buildDocumentGroundedOrganization(
      [{ fileName: 'Pay_March.pdf', category: 'Pay Records', uploadedFileId: 'f1' }],
      [
        {
          uploadedFileId: 'f1',
          fileName: 'Pay_March.pdf',
          category: 'Pay Records',
          extractedText: PAY_STUB_TEXT,
          qualityFlags: null,
        },
      ],
      null,
      { employmentMatterTags: ['wage_hour'] }
    );
    expect(org).not.toBeNull();
    if (!org) return;
    const text = [...org.sections.potential_gaps, ...org.sections.clarification_items].join('\n');
    expect(text).toMatch(/Wage & Hour/i);
    expect(text).not.toMatch(/No pay stub records were located/i);
  });
});
