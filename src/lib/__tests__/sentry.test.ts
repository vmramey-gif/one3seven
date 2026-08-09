import { describe, expect, it } from 'vitest';
import { scrubEvent, scrubString, scrubValue } from '../sentry';

/**
 * Regression suite for the Sentry PII scrubber (2026-08-09 security audit). A prior audit found
 * the key-name pattern was written against generic PII vocabulary and missed real field names
 * this app's data model actually uses — this file pins the fields that must be redacted so a
 * future edit to the pattern can't silently regress on any of them.
 */

describe('scrubString', () => {
  it('redacts SSN-shaped strings', () => {
    expect(scrubString('SSN on file: 123-45-6789')).toBe('[redacted:ssn-pattern]');
  });

  it('leaves short, non-sensitive strings alone', () => {
    expect(scrubString('draft')).toBe('draft');
  });

  it('truncates long strings as a last resort', () => {
    const long = 'a'.repeat(250);
    expect(scrubString(long)).toBe('[redacted:long-string 250 chars]');
  });
});

describe('scrubValue — real document_facts field names', () => {
  const cases: Array<[string, unknown]> = [
    ['people_mentioned', ['Rosa Martinez', 'Dan Ramirez']],
    ['witness_name', 'Rosa Martinez'],
    ['employer_name', 'Bramblewood Home & Garden LLC'],
    ['stated_reason', 'Poor performance'],
    ['complaint_topic', 'Unpaid overtime'],
    ['complaint_date', '2026-02-14'],
    ['relationship_to_worker', 'Direct supervisor'],
    ['policy_cited', 'Handbook section 4.2'],
    ['issued_by', 'HR Department'],
    ['pay_rate', '$18.50/hr'],
    ['gross_pay', '$2,400'],
    ['net_pay', '$1,950'],
    ['overtime_hours', '12'],
    ['overtime_rate', '$27.75'],
    ['damages_sources', 'Pay stub Feb 2026, 6 unpaid OT hours'],
    ['worker_context', 'Worker states this happened right after the complaint'],
    ['key_quote', 'You should not have gone to HR about this'],
    ['document_date', '2026-02-14'], // caught by the pre-existing "document" term, not new
  ];

  it.each(cases)('redacts key "%s"', (key, value) => {
    expect(scrubValue(value, key, 0)).toBe('[redacted:sensitive-key]');
  });

  it('redacts communication_parties as a whole (the key itself matches "part(y|ies)")', () => {
    const result = scrubValue(
      { communication_parties: [{ name: 'Rosa Martinez', role: 'HR' }] },
      null,
      0
    ) as { communication_parties: unknown };
    expect(result.communication_parties).toBe('[redacted:sensitive-key]');
  });
});

describe('scrubValue — uploaded_files field names', () => {
  it('redacts file_name (original filenames can carry PII, e.g. "SSN_card.pdf")', () => {
    expect(scrubValue('SSN_card.pdf', 'file_name', 0)).toBe('[redacted:sensitive-key]');
  });

  it('redacts file_path', () => {
    expect(scrubValue('worker-uuid/intake-uuid/file.pdf', 'file_path', 0)).toBe(
      '[redacted:sensitive-key]'
    );
  });
});

describe('scrubValue — worker_metadata field names', () => {
  it('redacts storyFollowUp and its nested fields as a whole (parent key match)', () => {
    const result = scrubValue(
      { storyFollowUp: { keyPeople: 'Manager: Jane Doe', employer: 'Acme Corp' } },
      'storyFollowUp',
      0
    );
    expect(result).toBe('[redacted:sensitive-key]');
  });

  it('redacts workerStory', () => {
    expect(scrubValue('I was fired after reporting unpaid wages', 'workerStory', 0)).toBe(
      '[redacted:sensitive-key]'
    );
  });
});

describe('scrubValue — non-sensitive fields still pass through', () => {
  const safe: Array<[string, unknown]> = [
    ['confidence', 0.92],
    ['category', 'Pay Stub'],
    ['flags', ['low_confidence']],
  ];

  it.each(safe)('does not redact key "%s"', (key, value) => {
    expect(scrubValue(value, key, 0)).toEqual(value);
  });
});

describe('scrubEvent', () => {
  it('scrubs extra, contexts, request, and breadcrumb data/messages', () => {
    const event = {
      extra: { employer_name: 'Acme Corp', intakeId: 'abc-123' },
      contexts: { custom: { witness_name: 'Rosa Martinez' } },
      request: { data: { pay_rate: '$18.50/hr' } },
      breadcrumbs: [
        { message: 'SSN 123-45-6789 found', data: { stated_reason: 'Retaliation' } },
      ],
    } as any;

    const scrubbed = scrubEvent(event);

    expect(scrubbed.extra?.employer_name).toBe('[redacted:sensitive-key]');
    expect(scrubbed.extra?.intakeId).toBe('abc-123'); // non-sensitive id passes through
    expect((scrubbed.contexts?.custom as any).witness_name).toBe('[redacted:sensitive-key]');
    expect((scrubbed.request as any).data.pay_rate).toBe('[redacted:sensitive-key]');
    expect(scrubbed.breadcrumbs?.[0].message).toBe('[redacted:ssn-pattern]');
    expect((scrubbed.breadcrumbs?.[0].data as any).stated_reason).toBe('[redacted:sensitive-key]');
  });

  it('leaves exception messages and stack traces intact (code paths, not document content)', () => {
    const event = {
      exception: { values: [{ value: 'Cannot read property of undefined', type: 'TypeError' }] },
    } as any;
    const scrubbed = scrubEvent(event);
    expect(scrubbed.exception?.values?.[0].value).toBe('Cannot read property of undefined');
  });
});
