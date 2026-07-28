import { describe, it, expect } from 'vitest';
import { stripFilenameReferences } from '../filenameScrub';

describe('stripFilenameReferences (worker-surface filename scrub)', () => {
  it('removes a labeled reference AND leaves no orphaned extension (the leak)', () => {
    const out = stripFilenameReferences('The worker filed a complaint. References: Rosa_Statement.pdf');
    expect(out).not.toMatch(/\.pdf/i);
    expect(out).not.toMatch(/Rosa_Statement/);
    expect(out).not.toMatch(/\bpdf\b/i);
    expect(out).toContain('The worker filed a complaint.');
  });

  it('scrubs comma-separated filename lists including every extension', () => {
    const out = stripFilenameReferences(
      'Uploaded records show Marquez_HR_Complaint_2026-01-12.pdf, Marquez_PayStub.png, note.docx'
    );
    expect(out).not.toMatch(/\.(pdf|png|docx)\b/i);
    expect(out).not.toMatch(/Marquez_HR_Complaint/);
  });

  it('removes bare filename tokens even without a labeling phrase', () => {
    const out = stripFilenameReferences('See Screenshot_4.png for the schedule.');
    expect(out).not.toMatch(/Screenshot_4\.png/i);
    expect(out).not.toMatch(/\.png/i);
  });

  it('leaves ordinary prose (no filenames) untouched', () => {
    const prose = 'The worker raised a concern with HR and was later separated.';
    expect(stripFilenameReferences(prose)).toBe(prose);
  });

  it('does not strip a normal sentence-ending period', () => {
    const out = stripFilenameReferences('A record was added to the chronology.');
    expect(out).toBe('A record was added to the chronology.');
  });
});
