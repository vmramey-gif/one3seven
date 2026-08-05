import { describe, it, expect } from 'vitest';
import {
  buildPerFileOrganizationRecords,
  collectPeopleFromDocumentFacts,
} from '../perFileOrganizationService';
import { assessEmployerRecordCoverage } from '../caEmployerRecordRequirements';
import { buildEvidenceMappedTimelineEvents } from '../evidenceMappedTimelineService';
import {
  pickSupportingRecordsForEvent,
  prepareChronologyPresentationEvent,
} from '../packetChronologyIntelligence';
import type { IntakeFileOrganizationRecord } from '../intakeOrganizationTypes';

// ---------------------------------------------------------------------------
// Blocker 1 — people index consumes document_facts (people_mentioned +
// communication_parties), not just text-regex mining.
// ---------------------------------------------------------------------------

describe('people from document_facts', () => {
  it('reads people_mentioned (strings) and communication_parties ({name, role})', () => {
    const people = collectPeopleFromDocumentFacts({
      people_mentioned: ['Dana Kimura', 'ROB PACHECO'],
      communication_parties: [
        { name: 'Priya Shah', role: 'Supervisor' },
        { name: 'dana kimura', role: 'recipient' }, // case-insensitive dup of Dana Kimura
      ],
    });
    expect(people).toContain('Dana Kimura');
    expect(people).toContain('ROB PACHECO');
    expect(people).toContain('Priya Shah');
    expect(people.filter((p) => p.toLowerCase() === 'dana kimura')).toHaveLength(1);
  });

  it('accepts string entries inside communication_parties and object entries inside people_mentioned', () => {
    const people = collectPeopleFromDocumentFacts({
      people_mentioned: [{ name: 'Jordan Vale', role: 'witness' }],
      communication_parties: ['Sam Ortiz'],
    });
    expect(people).toContain('Jordan Vale');
    expect(people).toContain('Sam Ortiz');
  });

  it('drops email addresses and urls (contact data, not names)', () => {
    const people = collectPeopleFromDocumentFacts({
      people_mentioned: ['dana.kimura@acme.example', 'www.acme.example', 'Dana Kimura'],
      communication_parties: [],
    });
    expect(people).toEqual(['Dana Kimura']);
  });

  it('handles null/malformed facts without throwing', () => {
    expect(collectPeopleFromDocumentFacts(null)).toEqual([]);
    expect(collectPeopleFromDocumentFacts(undefined)).toEqual([]);
    expect(
      collectPeopleFromDocumentFacts({ people_mentioned: 'not-an-array', communication_parties: 42 })
    ).toEqual([]);
  });

  it('threads facts people into file records and the people index (empty text layer, facts only)', () => {
    const meta = [{ uploadedFileId: 'f1', fileName: 'scan_001.pdf', category: 'Uncategorized' }];
    const { fileRecords, peopleIndex } = buildPerFileOrganizationRecords(meta, [
      {
        uploadedFileId: 'f1',
        fileName: 'scan_001.pdf',
        category: 'Uncategorized',
        extractedText: '', // scanned file: no text layer, facts only
        documentFacts: {
          people_mentioned: ['Dana Kimura', 'Rob Pacheco'],
          communication_parties: [{ name: 'Priya Shah', role: 'HR Generalist' }],
        },
      },
    ]);
    expect(fileRecords[0].people_or_entities).toEqual(
      expect.arrayContaining(['Dana Kimura', 'Rob Pacheco', 'Priya Shah'])
    );
    const indexBlob = peopleIndex.join(' | ').toLowerCase();
    expect(indexBlob).toContain('dana kimura');
    expect(indexBlob).toContain('rob pacheco');
    expect(indexBlob).toContain('priya shah');
  });

  it('prefers named individuals over generic role-parties, but keeps a lone role-party', () => {
    const withNames = collectPeopleFromDocumentFacts({
      people_mentioned: ['Human Resources', 'Dana Kimura'],
    });
    // Both survive raw collection; the merge filter is what drops generics.
    const meta = [{ uploadedFileId: 'f1', fileName: 'email_thread.pdf', category: null }];
    const { fileRecords } = buildPerFileOrganizationRecords(meta, [
      {
        uploadedFileId: 'f1',
        fileName: 'email_thread.pdf',
        category: null,
        extractedText: '',
        documentFacts: { people_mentioned: ['Human Resources', 'Dana Kimura'] },
      },
    ]);
    expect(fileRecords[0].people_or_entities).toContain('Dana Kimura');
    expect(fileRecords[0].people_or_entities).not.toContain('Human Resources');
    expect(withNames).toContain('Dana Kimura');

    const { fileRecords: loneRole } = buildPerFileOrganizationRecords(meta, [
      {
        uploadedFileId: 'f1',
        fileName: 'email_thread.pdf',
        category: null,
        extractedText: '',
        documentFacts: { communication_parties: [{ name: 'Human Resources', role: 'sender' }] },
      },
    ]);
    expect(loneRole[0].people_or_entities).toContain('Human Resources');
  });
});

// ---------------------------------------------------------------------------
// Blocker 2 — coverage rail content signals (conservative; false "present" is
// worse than false "missing").
// ---------------------------------------------------------------------------

describe('coverage rail content signals', () => {
  it('final paycheck: pay record with explicit final-pay wording in its own text', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'stub_march.pdf',
        category: '',
        textSnippet: 'Earnings Statement — FINAL PAYCHECK issued to employee upon separation.',
      },
    ]);
    expect(r.items.find((i) => i.key === 'final_pay')?.state).toBe('on_file');
  });

  it('final paycheck: pay date after a separation date established by the record set', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'notice.pdf',
        category: 'Separation Records',
        documentFacts: { effective_date: 'April 11, 2025' },
      },
      {
        fileName: 'stub_5.pdf',
        category: '',
        documentFacts: { gross_pay: '2871.44', document_date: '04/18/2025' },
      },
    ]);
    expect(r.items.find((i) => i.key === 'final_pay')?.state).toBe('on_file');
  });

  it('final paycheck: manual-check wording counts only alongside a separation document', () => {
    const withSeparation = assessEmployerRecordCoverage([
      { fileName: 'notice.pdf', category: 'Separation Records', documentFacts: {} },
      { fileName: 'stub.pdf', category: '', textSnippet: 'Earnings Statement Net Pay Distribution Manual Check 2410.66' },
    ]);
    expect(withSeparation.items.find((i) => i.key === 'final_pay')?.state).toBe('on_file');

    const noSeparation = assessEmployerRecordCoverage([
      { fileName: 'stub.pdf', category: '', textSnippet: 'Earnings Statement Net Pay Distribution Manual Check 2410.66' },
    ]);
    expect(noSeparation.items.find((i) => i.key === 'final_pay')?.state).toBe('not_in_record');
  });

  it('final paycheck: NO false positive from an ordinary stub dated before the separation', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'notice.pdf',
        category: 'Separation Records',
        documentFacts: { effective_date: 'April 11, 2025' },
      },
      {
        fileName: 'stub_1.pdf',
        category: '',
        documentFacts: { gross_pay: '1980.00', document_date: '02/07/2025' },
        textSnippet: 'Earnings Statement Pay Date: 02/07/2025',
      },
    ]);
    expect(r.items.find((i) => i.key === 'final_pay')?.state).toBe('not_in_record');
  });

  it('offer/agreement: agreement body wording in the file itself', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'letter_2023.pdf',
        category: '',
        textSnippet: 'Dear candidate, we are pleased to offer you the position of analyst.',
      },
    ]);
    expect(r.items.find((i) => i.key === 'offer_or_agreement')?.state).toBe('on_file');
  });

  it('offer/agreement: document executed between Employee and Employer party roles', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'scan_014.pdf',
        category: 'Uncategorized',
        documentFacts: {
          communication_parties: [
            { name: 'Jordan Vale', role: 'Employee' },
            { name: 'Acme Widgets LLC', role: 'Employer' },
          ],
        },
      },
    ]);
    expect(r.items.find((i) => i.key === 'offer_or_agreement')?.state).toBe('on_file');
  });

  it('offer/agreement: stored facts carrying the full offer-terms triple', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'scan_020.pdf',
        category: 'Uncategorized',
        documentFacts: {
          position_title: 'Route Coordinator',
          start_date: 'August 4, 2022',
          pay_rate: '$58,500 per year',
        },
      },
    ]);
    expect(r.items.find((i) => i.key === 'offer_or_agreement')?.state).toBe('on_file');
  });

  it('offer/agreement: NO false positive from a document that merely mentions an agreement', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'hr_email.pdf',
        category: '',
        textSnippet:
          'A reminder that the confidentiality and non-disclosure agreement you signed at hire remains in effect after your last day.',
        documentFacts: {
          communication_parties: [
            { name: 'Jordan Vale', role: 'recipient' },
            { name: 'Human Resources', role: 'sender' },
          ],
        },
      },
    ]);
    expect(r.items.find((i) => i.key === 'offer_or_agreement')?.state).toBe('not_in_record');
  });

  it('personnel file: multi-document employment-file production (≥3 distinct form markers in one file)', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'scan_007.pdf',
        category: 'Uncategorized',
        documentFacts: {
          flags: [
            'Single file combines several unrelated forms: NDA, handbook acknowledgement, payroll form, tax form',
            'Packet mixes IRS Form W-4 pages with a USCIS Form I-9 and copies of ID documents',
          ],
        },
      },
    ]);
    expect(r.items.find((i) => i.key === 'personnel_file')?.state).toBe('on_file');
  });

  it('personnel file: explicit personnel-file wording in the file text', () => {
    const r = assessEmployerRecordCoverage([
      { fileName: 'scan_009.pdf', category: '', textSnippet: 'Personnel File — contents produced for employee.' },
    ]);
    expect(r.items.find((i) => i.key === 'personnel_file')?.state).toBe('on_file');
  });

  it('personnel file: NO false positive from a single form (one marker is not a production)', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'scan_011.pdf',
        category: 'Uncategorized',
        documentFacts: { flags: ['IRS Form W-4 worksheet only'] },
      },
    ]);
    expect(r.items.find((i) => i.key === 'personnel_file')?.state).toBe('not_in_record');
  });

  it('content signals never mark unrelated requirements present (§2810.5 stays a gap)', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'notice.pdf',
        category: 'Separation Records',
        documentFacts: { effective_date: 'April 11, 2025' },
      },
      {
        fileName: 'stub_5.pdf',
        category: '',
        documentFacts: { gross_pay: '2871.44', document_date: '04/18/2025' },
      },
    ]);
    expect(r.items.find((i) => i.key === 'wtpa_notice')?.state).toBe('not_in_record');
    expect(r.items.find((i) => i.key === 'meal_rest')?.state).toBe('not_in_record');
  });

  it('plain filename/category rows (no facts, no snippet) behave exactly as before', () => {
    const r = assessEmployerRecordCoverage([
      { fileName: 'Final_Paycheck.pdf', category: '' },
      { fileName: 'offer-letter-2022.pdf', category: '' },
    ]);
    expect(r.items.find((i) => i.key === 'final_pay')?.state).toBe('on_file');
    expect(r.items.find((i) => i.key === 'offer_or_agreement')?.state).toBe('on_file');
  });
});

// ---------------------------------------------------------------------------
// Blockers 3 + 4a — termination-title guard and order-independent cluster dates.
// ---------------------------------------------------------------------------

function rec(partial: {
  id: string;
  fileName: string;
  category?: string | null;
  likelyDate?: string | null;
  topics?: string[];
  eventDate?: string | null;
}): IntakeFileOrganizationRecord {
  return {
    source_file_id: partial.id,
    file_name: partial.fileName,
    document_type: 'Additional Supporting Records',
    legacy_upload_category: partial.category ?? null,
    likely_date: partial.likelyDate ?? null,
    people_or_entities: [],
    employment_topics: partial.topics ?? [],
    possible_timeline_event: partial.eventDate
      ? { title: 'Record noted', date: partial.eventDate, neutral_summary: '' }
      : null,
    supporting_record_strength: 'partial',
    missing_or_unclear_information: [],
    confidence: 'medium',
    extraction_quality: 'high',
  };
}

describe('termination-title guard (title-selection chokepoint)', () => {
  it('separation TOPICS alone never title an event "Termination documented" (EDD-pamphlet cluster)', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        rec({
          id: 'edd',
          fileName: 'benefits_program_booklet.pdf',
          category: 'Uncategorized',
          topics: ['Separation and final pay'],
          likelyDate: '11/20/2025',
        }),
        rec({
          id: 'post',
          fileName: 'post_employment_info.pdf',
          category: 'Uncategorized',
          topics: ['Separation and final pay'],
          likelyDate: '11/20/2025',
        }),
      ],
    });
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e.title).not.toMatch(/^(termination documented|employment ends)\b/i);
    }
    expect(events.some((e) => e.title === 'Supporting employment documentation')).toBe(true);
  });

  it('a separation-categorized source keeps the termination-flavored title', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        rec({
          id: 'sep',
          fileName: 'separation_letter.pdf',
          category: 'Separation Records',
          topics: ['Separation and final pay'],
          likelyDate: 'May 2, 2025',
        }),
      ],
    });
    expect(events.some((e) => /^(termination documented|employment ends)\b/i.test(e.title))).toBe(true);
  });

  it('a separation-classified FILENAME also satisfies the guard (no stored category)', () => {
    const events = buildEvidenceMappedTimelineEvents({
      fileRecords: [
        rec({
          id: 'sep2',
          fileName: 'termination_notice_march.pdf',
          category: null,
          topics: ['Separation and final pay'],
          likelyDate: 'May 2, 2025',
        }),
      ],
    });
    expect(events.some((e) => /^(termination documented|employment ends)\b/i.test(e.title))).toBe(true);
  });
});

describe('order-independent cluster dates', () => {
  const undated = () =>
    rec({ id: 'c', fileName: 'wage_summary.pdf', topics: ['Payroll and wages'] });
  const w2a = () =>
    rec({ id: 'a', fileName: 'w2_form_a.pdf', topics: ['Payroll and wages'], likelyDate: '2024' });
  const w2b = () =>
    rec({ id: 'b', fileName: 'w2_form_b.pdf', topics: ['Payroll and wages'], likelyDate: '2023' });

  const runDates = (records: IntakeFileOrganizationRecord[], documentDates?: Record<string, string>) =>
    buildEvidenceMappedTimelineEvents({ fileRecords: records, documentDates })
      .map((e) => `${e.date}|${e.title}`)
      .sort();

  it('a mixed-date cluster resolves to the earliest parseable date regardless of file order', () => {
    const order1 = runDates([undated(), w2a(), w2b()]);
    const order2 = runDates([undated(), w2b(), w2a()]);
    expect(order1).toEqual(order2);
    expect(order1.join(' ')).toContain('2023|');
    expect(order1.join(' ')).not.toContain('2024|');
  });

  it('an authoritative extraction-stored document date beats earlier text-mined dates, in any order', () => {
    const documentDates = { a: '03/14/2025' };
    const order1 = runDates([undated(), w2a(), w2b()], documentDates);
    const order2 = runDates([undated(), w2b(), w2a()], documentDates);
    expect(order1).toEqual(order2);
    expect(order1.some((d) => d.startsWith('03/14/2025|'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Blocker 4b — supporting records: own sources first; keyword additions never
// contradict the event's year; deterministic under inventory shuffles.
// ---------------------------------------------------------------------------

describe('supporting-record selection', () => {
  it("cites the event's own source files, not keyword matches", () => {
    const event = {
      date: '02/07/2025',
      title: 'Employment activity documented through payroll records',
      category: 'Pay Records',
      summary: '',
      sourceFileNames: ['stub_jan.pdf'],
    };
    const inventory = [
      { fileName: 'stub_jan.pdf', category: 'Pay Records' },
      { fileName: 'worker_2023_W2.pdf', category: 'Pay Records' },
    ];
    const picks = pickSupportingRecordsForEvent(event.title, event, inventory);
    expect(picks).toHaveLength(1);
    expect(picks[0].toLowerCase()).toContain('stub');
    expect(picks.join(' ').toLowerCase()).not.toContain('w2');
  });

  it('keyword additions never introduce a file whose filename year contradicts the event year', () => {
    const event = {
      date: '02/07/2025',
      title: 'Employment activity documented through payroll records',
      category: 'Pay Records',
      summary: '',
    };
    const contradicted = pickSupportingRecordsForEvent(event.title, event, [
      { fileName: 'worker_2023_W2.pdf', category: 'Pay Records' },
    ]);
    expect(contradicted).toEqual([]);

    const sameYear = pickSupportingRecordsForEvent(event.title, event, [
      { fileName: 'worker_2025_W2.pdf', category: 'Pay Records' },
    ]);
    expect(sameYear.length).toBe(1);
  });

  it('detects the year inside compact scanner-style prefixes (20241118093012_...)', () => {
    const event = {
      date: '2023',
      title: 'Schedule change documented',
      category: 'Time Records',
      summary: '',
    };
    const picks = pickSupportingRecordsForEvent(event.title, event, [
      { fileName: '20241118093012_time_detail_report_ab12.pdf', category: 'Time Records' },
    ]);
    expect(picks).toEqual([]);
  });

  it('keyword picks are deterministic regardless of inventory order', () => {
    const event = {
      date: '02/07/2025',
      title: 'Employment activity documented through payroll records',
      category: 'Pay Records',
      summary: '',
    };
    const inventory = [
      { fileName: 'stub_alpha.pdf', category: 'Pay Records' },
      { fileName: 'stub_beta.pdf', category: 'Pay Records' },
      { fileName: 'stub_gamma.pdf', category: 'Pay Records' },
    ];
    const forward = pickSupportingRecordsForEvent(event.title, event, inventory);
    const reversed = pickSupportingRecordsForEvent(event.title, event, [...inventory].reverse());
    expect(forward).toEqual(reversed);
  });

  it('presentation keeps own sources even when the association score would drop them', () => {
    const prepared = prepareChronologyPresentationEvent(
      {
        date: '11/20/2025',
        title: 'Supporting employment documentation',
        category: 'Uncategorized',
        summary: '',
        sourceFileNames: ['benefits_program_booklet.pdf'],
      },
      3,
      [{ fileName: 'benefits_program_booklet.pdf', category: 'Uncategorized' }]
    );
    expect(prepared.supportingUploads.length).toBe(1);
    expect(prepared.supportingUploads[0].toLowerCase()).toContain('booklet');
  });
});
