import { describe, expect, it } from 'vitest';
import {
  buildWorkerDocumentRequestPayloadFromSummary,
  buildWorkerDocumentRequestView,
  getWorkerDocumentRequestStatus,
  resolveWorkerFirmDocumentRequest,
} from '../workerDocumentRequest';

describe('resolveWorkerFirmDocumentRequest', () => {
  it('reads categories and note from overview block', () => {
    const overview = `Intro text
\n--- O3S_FIRM_DOCUMENT_REQUEST ---
categories:Pay records / paystubs|Schedules
note:Please upload late 2024 records
--- O3S_FIRM_DOCUMENT_REQUEST_END ---
`;
    expect(resolveWorkerFirmDocumentRequest(overview, [])).toEqual({
      categories: ['Pay records / paystubs', 'Schedules'],
      note: 'Please upload late 2024 records',
    });
  });

  it('falls back to missing_document_alerts lines', () => {
    expect(
      resolveWorkerFirmDocumentRequest('', [
        'Firm requested: Time records / timecards',
        'Firm note: Include overtime weeks',
      ])
    ).toEqual({
      categories: ['Time records / timecards'],
      note: 'Include overtime weeks',
    });
  });
});

describe('buildWorkerDocumentRequestView', () => {
  it('prefers notification payload over summary', () => {
    const view = buildWorkerDocumentRequestView(
      {
        requested_categories: ['Schedules'],
        firm_note: 'From bell',
        firm_name: 'Zoey Law',
      },
      '\n--- O3S_FIRM_DOCUMENT_REQUEST ---\ncategories:Other\nnote:Old\n--- O3S_FIRM_DOCUMENT_REQUEST_END ---\n',
      [],
      'Linked Firm'
    );
    expect(view).toEqual({
      categories: ['Schedules'],
      note: 'From bell',
      firmName: 'Zoey Law',
    });
  });
});

describe('getWorkerDocumentRequestStatus', () => {
  it('maps workflow statuses', () => {
    expect(getWorkerDocumentRequestStatus('Additional Documents Requested')).toBe('pending');
    expect(getWorkerDocumentRequestStatus('Worker Uploaded Additional Documents')).toBe('uploaded');
    expect(getWorkerDocumentRequestStatus('Worker Uploaded Requested Documents')).toBe('submitted');
    expect(getWorkerDocumentRequestStatus('Intake Summary Generated')).toBeNull();
  });
});

describe('buildWorkerDocumentRequestPayloadFromSummary', () => {
  it('builds payload for App state hydration', () => {
    const payload = buildWorkerDocumentRequestPayloadFromSummary(
      '\n--- O3S_FIRM_DOCUMENT_REQUEST ---\ncategories:Other\nnote:Need docs\n--- O3S_FIRM_DOCUMENT_REQUEST_END ---\n',
      [],
      'Zoey Law'
    );
    expect(payload).toEqual({
      requested_categories: ['Other'],
      firm_note: 'Need docs',
      firm_name: 'Zoey Law',
    });
  });
});
