import { describe, expect, test } from 'vitest';
import {
  synthesizeIntakeIntelligence,
  deriveNamedPeopleForIntake,
  type DocumentFacts,
  type FileWithFacts,
} from '../documentFactsService';

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

function file(category: string, fileName: string, p: Partial<DocumentFacts>): FileWithFacts {
  return {
    uploaded_file_id: fileName,
    file_name: fileName,
    category,
    extraction_status: 'completed',
    fact_extraction_status: 'completed',
    document_facts: facts({ category, file_name: fileName, ...p }),
  };
}

describe('synthesizeIntakeIntelligence — task_8d413384 firm-output fixes', () => {
  test('final paystub filed under Separation Records still suppresses the separation clarification', () => {
    const intel = synthesizeIntakeIntelligence([
      file('Separation Records', 'Termination_Letter_Sep2024.pdf', { document_date: '2024-09-12', stated_reason: 'Performance' }),
      file('Separation Records', 'Final_Paystub_September_2024.pdf', { key_quote: 'Final pay statement' }),
    ]);
    expect(intel.clarificationQuestions.join('\n')).not.toMatch(/final paystub .* was not detected/i);
  });

  test('a termination key-quote suppresses "reason for termination not yet extracted"', () => {
    const intel = synthesizeIntakeIntelligence([
      // No stated_reason field, but the document is quoted — the reason is already surfaced.
      file('Separation Records', 'Termination_Letter.pdf', { key_quote: 'Reason: Performance and conduct.' }),
    ]);
    expect(intel.confirmationNeeded.join('\n')).not.toMatch(/reason for termination not yet extracted/i);
  });

  test('key-quote category falls back from Uncategorized to the facts category', () => {
    const intel = synthesizeIntakeIntelligence([
      {
        uploaded_file_id: 'x',
        file_name: 'Termination_Letter.pdf',
        category: 'Uncategorized',
        extraction_status: 'completed',
        fact_extraction_status: 'completed',
        document_facts: facts({ category: 'Separation Records', file_name: 'Termination_Letter.pdf', key_quote: 'Reason: performance' }),
      },
    ]);
    expect(intel.keyQuotes[0]?.category).toBe('Separation Records');
  });
});

describe('deriveNamedPeopleForIntake (2026-08-18 founder review) — peopleRoleInference.ts was already built and tested but never called from any live screen', () => {
  test('names real people from people_mentioned and communication_parties, infers HR role from issued_by context', () => {
    const people = deriveNamedPeopleForIntake([
      file('Offer Letters', '01-offer-letter.pdf', {
        people_mentioned: ['Marcus Delgado', 'Renee Ashford'],
        issued_by: 'Renee Ashford, HR Manager',
        communication_parties: [
          { name: 'Renee Ashford', role: 'sender' },
          { name: 'Marcus Delgado', role: 'recipient' },
        ],
      }),
    ]);
    const names = people.map((p) => p.name);
    expect(names).toContain('Marcus Delgado');
    expect(names).toContain('Renee Ashford');
    const renee = people.find((p) => p.name === 'Renee Ashford');
    expect(renee?.role).toBe('Human Resources Representative');
  });

  test('excludes generic role labels that occasionally land in a name field', () => {
    const people = deriveNamedPeopleForIntake([
      file('Workplace Communications', 'hr_email.pdf', {
        people_mentioned: ['Jordan Lee'],
        communication_parties: [
          { name: 'Human Resources', role: 'sender' },
          { name: 'Jordan Lee', role: 'recipient' },
        ],
      }),
    ]);
    const names = people.map((p) => p.name);
    expect(names).toEqual(['Jordan Lee']);
    expect(names).not.toContain('Human Resources');
  });

  test('dedupes the same person named in multiple files', () => {
    const people = deriveNamedPeopleForIntake([
      file('Offer Letters', 'offer.pdf', { people_mentioned: ['Marcus Delgado', 'Renee Ashford'] }),
      file('Separation Records', 'termination.pdf', { people_mentioned: ['Marcus Delgado', 'Renee Ashford'] }),
    ]);
    expect(people.length).toBe(2);
  });
});
