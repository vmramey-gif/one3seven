import { describe, it, expect } from 'vitest';
import { assessEmployerRecordCoverage } from '../caEmployerRecordRequirements';
import {
  buildPerFileOrganizationRecords,
  mealPeriodRecordLineFromFacts,
} from '../perFileOrganizationService';
import { buildDocumentGroundedOrganization } from '../documentGroundedOrganizationService';

// ---------------------------------------------------------------------------
// Multi-persona gauntlet blockers — all data below is synthetic.
//
// P3-10: an attendance POLICY page must never mark hours records "present".
// P1-3:  a template-footer date must never beat the extraction-stored document date.
// P5-11: extraction-stored meal-period facts must surface as a presence description.
// ---------------------------------------------------------------------------

const state = (r: ReturnType<typeof assessEmployerRecordCoverage>, key: string) =>
  r.items.find((i) => i.key === key)?.state;

describe('time/meal coverage presence gates (conservative: false present is the worst failure)', () => {
  it('an attendance-policy handbook page does NOT mark time_records present', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Attendance Policy - Staff Handbook p3.pdf',
        category: 'Time Records', // filename-inferred category — exactly the trap
        textSnippet:
          'RIVERBEND SUPPLY CO. — STAFF HANDBOOK\nSection 4: Attendance and Punctuality\n\n' +
          'Team members are expected to be ready to work at the scheduled start time. ' +
          'A team member who clocks in more than five minutes after scheduled start is recorded as tardy. ' +
          'Three tardies within a rolling ninety-day period results in a written warning.',
      },
    ]);
    expect(state(r, 'time_records')).toBe('not_in_record');
  });

  it('a punch export with clock in/out columns marks time_records present (English)', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Punch Export April 2025 - Delgado.pdf',
        category: 'Time Records',
        textSnippet:
          'POS TIME PUNCH EXPORT\nEmployee: DELGADO, MARISOL\n\n' +
          'Date        Clock In   Clock Out   Meal Punch   Hours\n' +
          '04/01/2025  9:58 AM    6:41 PM     none         8.72\n' +
          '04/02/2025  10:01 AM   6:39 PM     none         8.63\n' +
          'Total hours: 17.35',
      },
    ]);
    expect(state(r, 'time_records')).toBe('on_file');
  });

  it('a Spanish hours report ("Reporte de Horas") marks time_records present', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Reporte de Horas abril 2025.pdf',
        category: 'Time Records',
        textSnippet:
          'REPORTE DE HORAS\nEmpleada: DELGADO, MARISOL\n\n' +
          'Fecha        Entrada    Salida     Horas\n' +
          '01/04/2025   9:58 AM    6:41 PM    8.72\n' +
          'Total de horas: 8.72',
      },
    ]);
    expect(state(r, 'time_records')).toBe('on_file');
  });

  it('category-only matching still works for an opaque filename with an explicit timekeeping category', () => {
    const r = assessEmployerRecordCoverage([{ fileName: 'IMG_7712.jpg', category: 'Time Records' }]);
    expect(state(r, 'time_records')).toBe('on_file');
  });

  it('meal_rest requires punch-level meal data: meal punch rows count', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Punch Export April 2025 - Delgado.pdf',
        category: 'Time Records',
        textSnippet:
          'POS TIME PUNCH EXPORT\nDate        Clock In   Clock Out   Meal Punch   Hours\n' +
          '04/01/2025  9:58 AM    6:41 PM     none         8.72\n' +
          'No meal period recorded on 7 of 9 shifts over 6.0 hours.',
      },
    ]);
    expect(state(r, 'meal_rest')).toBe('on_file');
  });

  it('meal_rest: extraction-stored missed_breaks facts count', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'hours_report_scan.pdf',
        category: 'Time Records',
        documentFacts: {
          missed_breaks: 'no meal period punch on 7 of 9 shifts over 6.0 hours in this export',
        },
      },
    ]);
    expect(state(r, 'meal_rest')).toBe('on_file');
  });

  it('a schedule-level absence note in missed_breaks facts does NOT mark meal_rest present', () => {
    // "no meal period rows shown on schedule" describes a schedule LACKING meal data —
    // it is not punch-level meal-record data.
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Weekly_Schedule_June2025.pdf',
        category: 'Time Records',
        documentFacts: {
          missed_breaks: 'no meal period rows shown on schedule',
          flags: ['no meal period rows shown on schedule'],
        },
      },
    ]);
    expect(state(r, 'meal_rest')).toBe('not_in_record');
  });

  it('a punch-level extraction flag DOES mark meal_rest present', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'hours_report_scan.pdf',
        category: 'Time Records',
        documentFacts: {
          flags: ['no meal punch recorded on 7 of 9 shifts exceeding 6 hours in this export'],
        },
      },
    ]);
    expect(state(r, 'meal_rest')).toBe('on_file');
  });

  it('a handbook meal-break POLICY page does NOT mark meal_rest present', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Staff Handbook - Meal and Rest Breaks p9.pdf',
        category: 'Uncategorized',
        textSnippet:
          'RIVERBEND SUPPLY CO. — STAFF HANDBOOK\nSection 6: Meal and Rest Breaks\n\n' +
          'Team members scheduled to work more than five hours receive an unpaid 30-minute meal break. ' +
          'Team members receive a paid 10-minute rest break for every four hours worked.',
      },
    ]);
    expect(state(r, 'meal_rest')).toBe('not_in_record');
  });

  // Adversarial audit fix: the content-snippet branch of each presence gate ran BEFORE the
  // category+filename branch and had no policy-prose exclusion of its own, so an ordinary
  // handbook sentence could independently reproduce the exact false positive the
  // category+filename branch was already fixed to exclude — a second path into the same bug.
  it('a handbook sentence about clocking in/out does NOT mark time_records present via the content-snippet branch', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Attendance-Policy-Handbook.pdf',
        category: 'Uncategorized', // no category-branch match either — isolates the content branch
        textSnippet:
          'RIVERBEND SUPPLY CO. — STAFF HANDBOOK\nSection 4: Attendance and Punctuality\n\n' +
          'Employees are expected to clock in by 8:00 a.m. and clock out at 5:00 p.m. each ' +
          'scheduled workday. Employees who fail to do so may be subject to discipline.',
      },
    ]);
    expect(state(r, 'time_records')).toBe('not_in_record');
  });

  it('a handbook sentence about meal-period waiver does NOT mark meal_rest present via the content-snippet branch', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Meal-and-Rest-Break-Policy.pdf',
        category: 'Uncategorized',
        textSnippet:
          'RIVERBEND SUPPLY CO. — STAFF HANDBOOK\nSection 6: Meal and Rest Breaks\n\n' +
          'Consistent with California law, no meal period may be waived unless the shift is ' +
          'five hours or less and both parties agree in writing.',
      },
    ]);
    expect(state(r, 'meal_rest')).toBe('not_in_record');
  });

  it('genuine punch-level content-snippet matches still count present after the policy-prose fix (time)', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Punch Export April 2025 - Delgado.pdf',
        category: 'Uncategorized',
        textSnippet:
          'POS TIME PUNCH EXPORT\nEmployee: DELGADO, MARISOL\n\n' +
          'Date        Clock In   Clock Out   Meal Punch   Hours\n' +
          '04/01/2025  9:58 AM    6:41 PM     none         8.72',
      },
    ]);
    expect(state(r, 'time_records')).toBe('on_file');
  });

  it('genuine punch-level content-snippet matches still count present after the policy-prose fix (meal)', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Punch Export April 2025 - Delgado.pdf',
        category: 'Uncategorized',
        textSnippet:
          'POS TIME PUNCH EXPORT\nDate        Clock In   Clock Out   Meal Punch   Hours\n' +
          '04/01/2025  9:58 AM    6:41 PM     none         8.72\n' +
          'No meal period recorded on 7 of 9 shifts over 6.0 hours.',
      },
    ]);
    expect(state(r, 'meal_rest')).toBe('on_file');
  });

  it('a plain time record without meal data leaves meal_rest not_in_record', () => {
    const r = assessEmployerRecordCoverage([
      {
        fileName: 'Weekly_Schedule_June2025.pdf',
        category: 'Time Records',
        textSnippet: 'Weekly Schedule\nMon 6/2: 8:00 AM - 4:30 PM\nTue 6/3: 8:00 AM - 4:30 PM\nScheduled hours this week: 16.0',
      },
    ]);
    expect(state(r, 'time_records')).toBe('on_file'); // shift start–end pairs are time data
    expect(state(r, 'meal_rest')).toBe('not_in_record'); // …but not meal data
  });
});

// ---------------------------------------------------------------------------
// Per-file likely_date: extraction-stored document date is authoritative.
// ---------------------------------------------------------------------------

describe('per-file likely_date prefers document_facts.document_date', () => {
  const meta = [{ uploadedFileId: 'f1', fileName: 'Weekly_Schedule.pdf', category: 'Time Records' }];
  // Covered week is written year-less (like real schedule exports); the footer date is the
  // only fully-formed m/d/yyyy token — exactly the trap that beat text mining.
  const scheduleText =
    'Weekly Schedule — Week of May 5 – May 11\n' +
    'Mon 5/5: 8:00 AM – 4:30 PM\nTue 5/6: 8:00 AM – 4:30 PM\n' +
    'Printed from scheduler — template last revised 06/15/2023';

  const build = (documentFacts: Record<string, unknown> | null) =>
    buildPerFileOrganizationRecords(meta, [
      {
        uploadedFileId: 'f1',
        fileName: 'Weekly_Schedule.pdf',
        category: 'Time Records',
        extractedText: scheduleText,
        documentFacts,
      },
    ]).fileRecords[0];

  it('a usable facts date beats a template-footer date mined from text', () => {
    expect(build({ document_date: '05/05/2025' }).likely_date).toBe('05/05/2025');
  });

  it('trims a time-of-day suffix from the stored date', () => {
    expect(build({ document_date: '12/02/2025 08:46:46 AM CST' }).likely_date).toBe('12/02/2025');
  });

  it('without facts, text mining is unchanged (footer date stands)', () => {
    const record = build(null);
    expect(record.likely_date).toBeTruthy();
    expect(String(record.likely_date)).toMatch(/2023/);
  });

  it('an unusable facts date falls back to text mining', () => {
    const record = build({ document_date: 'Date unclear' });
    expect(String(record.likely_date)).toMatch(/2023/);
  });
});

// ---------------------------------------------------------------------------
// Meal-period record facts surface as presence descriptions (never conclusions).
// ---------------------------------------------------------------------------

const BANNED_CONCLUSION_RE = /violation|penalt|\bowed\b|entitled|226\.7|unlawful|wrongful/i;

describe('meal-period facts surface in the organization record (description only)', () => {
  it('missed_breaks facts produce a "Time records show …" line with no conclusion words', () => {
    const line = mealPeriodRecordLineFromFacts({
      missed_breaks: 'no meal period punch on 9 of 12 shifts over 6.0 hours in this export',
    });
    expect(line).toBe(
      'Time records show no meal period punch on 9 of 12 shifts over 6.0 hours in this export.'
    );
    expect(line).not.toMatch(BANNED_CONCLUSION_RE);
  });

  it('a schedule-level absence note is not surfaced (not punch-level data)', () => {
    expect(
      mealPeriodRecordLineFromFacts({ missed_breaks: 'no meal period rows shown on schedule' })
    ).toBeNull();
  });

  it('a facts value carrying conclusion vocabulary is dropped entirely', () => {
    expect(
      mealPeriodRecordLineFromFacts({ missed_breaks: 'meal premium penalty owed for 9 shifts' })
    ).toBeNull();
    expect(mealPeriodRecordLineFromFacts({ missed_breaks: 'missed breaks per § 226.7' })).toBeNull();
  });

  it('no missed-break facts → no line', () => {
    expect(mealPeriodRecordLineFromFacts({ missed_breaks: null })).toBeNull();
    expect(mealPeriodRecordLineFromFacts({})).toBeNull();
    expect(mealPeriodRecordLineFromFacts(null)).toBeNull();
  });

  it('the line lands on the time record summary and in readinessIndicators', () => {
    const meta = [
      { uploadedFileId: 'f1', fileName: 'Punch Export April 2025 - Delgado.pdf', category: 'Time Records' },
    ];
    const extractions = [
      {
        uploadedFileId: 'f1',
        fileName: 'Punch Export April 2025 - Delgado.pdf',
        category: 'Time Records',
        extractedText:
          'POS TIME PUNCH EXPORT\nEmployee: DELGADO, MARISOL\n' +
          'Date        Clock In   Clock Out   Meal Punch   Hours\n' +
          '04/01/2025  9:58 AM    6:41 PM     none         8.72\n' +
          'No meal period recorded on 7 of 9 shifts over 6.0 hours.',
        documentFacts: {
          document_date: '04/30/2025',
          missed_breaks: 'no meal period punch on 7 of 9 shifts over 6.0 hours in this export',
        },
      },
    ];

    const { fileRecords } = buildPerFileOrganizationRecords(meta, extractions);
    expect(fileRecords[0].possible_timeline_event?.neutral_summary).toMatch(
      /Time records show no meal period punch on 7 of 9 shifts/
    );

    const org = buildDocumentGroundedOrganization(meta, extractions, '');
    expect(org).not.toBeNull();
    const mealLines = org!.readinessIndicators.filter((l) => /no meal period punch/i.test(l));
    expect(mealLines.length).toBe(1);
    expect(mealLines[0]).not.toMatch(BANNED_CONCLUSION_RE);
  });

  it('no missed-break facts → no meal line anywhere', () => {
    const meta = [{ uploadedFileId: 'f1', fileName: 'stub_march.pdf', category: 'Pay Records / Payroll' }];
    const extractions = [
      {
        uploadedFileId: 'f1',
        fileName: 'stub_march.pdf',
        category: 'Pay Records / Payroll',
        extractedText: 'Earnings Statement\nPay Date: 03/14/2025\nGross Pay 1800.00\nNet Pay 1500.00',
        documentFacts: { document_date: '03/14/2025', missed_breaks: null },
      },
    ];
    const { fileRecords } = buildPerFileOrganizationRecords(meta, extractions);
    expect(fileRecords[0].possible_timeline_event?.neutral_summary ?? '').not.toMatch(
      /Time records show/
    );
    const org = buildDocumentGroundedOrganization(meta, extractions, '');
    expect(org!.readinessIndicators.some((l) => /meal/i.test(l))).toBe(false);
  });
});
