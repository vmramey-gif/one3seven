/**
 * Marketing copy guardrails — automated verb test.
 *
 * Scans the public-facing marketing files for banned copy so a UPL / outcome-promise /
 * trademark-overclaim regression cannot ship. This is the automated floor under
 * docs/COPY_STYLE_GUIDE.md and docs/LANDING_PAGE_CHECKLIST.md — it does NOT replace the
 * human verb test or the attorney review, it just makes the worst mistakes impossible to merge.
 *
 * Two tiers:
 *  - HARD: phrases that are essentially never safe, in any context.
 *  - NEGATABLE: unsafe *as a claim*, but legitimate inside a disclaimer that negates them
 *    ("does not recommend, rank, or select attorneys", "it never concludes"). These only
 *    count as a violation when NOT preceded by a negation within a short window.
 *
 * If a check false-positives on genuinely safe copy, tighten the pattern here — never weaken
 * the page to satisfy the test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const MARKETING_FILES = [
  'src/app/screens/SageMarketingPage.tsx',
  'src/app/screens/ForFirmsPage.tsx',
  'src/app/screens/BrandPreviewPage.tsx',
  'src/i18n/i18n.tsx',
];

// Never safe, in any context.
const HARD: { label: string; re: RegExp }[] = [
  { label: 'outcome: maximize', re: /\bmaximi[sz]e\b/gi },
  { label: 'outcome: recover more', re: /\brecover more\b/gi },
  { label: 'outcome: better outcome(s)', re: /\bbetter outcomes?\b/gi },
  { label: 'outcome: fewer denials', re: /\bfewer denials\b/gi },
  { label: 'outcome: get you (the/more/a bigger)', re: /\bget you (the|more|a bigger)\b/gi },
  { label: 'outcome: faster/higher settlement or payout', re: /\b(faster|higher|bigger) (settlement|payout|damages)\b/gi },
  { label: 'trademark: California-approved / adopted statewide', re: /\bcalifornia[-\s]?approved\b|\badopted statewide\b/gi },
  { label: 'trademark: Anthropic partner/certified/endorsed', re: /\b(certified|endorsed|partnered?) (by|with) anthropic\b|\banthropic[-\s](certified|endorsed|partner)\b/gi },
  { label: 'security: independently verified', re: /\bindependently verified\b/gi },
  { label: 'security: SOC 2', re: /\bSOC[-\s]?2\b/gi },
  { label: 'security: penetration tested', re: /\bpen(etration)?[-\s]?tested\b/gi },
];

// Unsafe as a *claim*; fine when negated (disclaimers). Flagged only if NOT negated nearby.
const NEGATABLE: { label: string; re: RegExp }[] = [
  { label: 'conclusion: you have a case/claim', re: /\byou (have|may have|might have) an? (case|claim)\b/gi },
  { label: 'conclusion: strong/weak case/claim/evidence', re: /\b(strong|weak) (case|claim|evidence)\b/gi },
  { label: 'conclusion: case scoring', re: /\bcase scoring\b/gi },
  { label: 'conclusion: claim value/valuation', re: /\bclaim valuation\b|\bclaim value\b/gi },
  { label: 'outcome: win your case/claim', re: /\bwin(ning)? your (case|claim)\b/gi },
  { label: 'outcome: guarantee', re: /\bguarantee[ds]?\b/gi },
  { label: 'legal act: legal advice', re: /\blegal advice\b/gi },
  { label: 'legal act: legal conclusion(s)', re: /\blegal conclusions?\b/gi },
  { label: 'legal act: settlement prediction', re: /\bsettlement (prediction|recommendation)\b/gi },
  { label: 'referral: recommend/rank/select an attorney/lawyer/firm', re: /\b(recommend|rank|select) (an? )?(attorney|lawyer|law firm|firm)\b/gi },
  { label: 'referral: route/match/steer/connect workers to attorneys', re: /\b(route|match|steer|connect|refer)\w* (workers?|clients?|you) (to|with) (an? )?(attorney|lawyer|firm)\b/gi },
];

// Negation OR quantification (a leading "0"/"zero"/number makes "0 legal conclusions" safe).
const NEGATION = /\b(no|not|never|cannot|can'?t|do(es)?n'?t|without|isn'?t|aren'?t|nor|non|un|zero|\d+)\b/i;

function isNegated(text: string, index: number): boolean {
  // look back a short window for a negation / quantifier word
  const window = text.slice(Math.max(0, index - 48), index);
  return NEGATION.test(window);
}

function scan(text: string): { label: string; snippet: string }[] {
  const hits: { label: string; snippet: string }[] = [];
  const snippetAt = (i: number) => text.slice(Math.max(0, i - 30), i + 40).replace(/\s+/g, ' ').trim();

  for (const { label, re } of HARD) {
    for (const m of text.matchAll(re)) hits.push({ label, snippet: snippetAt(m.index ?? 0) });
  }
  for (const { label, re } of NEGATABLE) {
    for (const m of text.matchAll(re)) {
      if (!isNegated(text, m.index ?? 0)) hits.push({ label, snippet: snippetAt(m.index ?? 0) });
    }
  }
  return hits;
}

describe('marketing copy guardrails (automated verb test)', () => {
  it('all target files still exist (guardrail cannot be bypassed by renaming)', () => {
    for (const rel of MARKETING_FILES) {
      expect(existsSync(ROOT + rel), `missing marketing file: ${rel}`).toBe(true);
    }
  });

  it('contains no banned outcome / conclusion / trademark / security copy', () => {
    const violations: string[] = [];
    for (const rel of MARKETING_FILES) {
      const full = ROOT + rel;
      if (!existsSync(full)) continue;
      const text = readFileSync(full, 'utf8');
      for (const hit of scan(text)) {
        violations.push(`${rel} — [${hit.label}] …${hit.snippet}…`);
      }
    }
    expect(violations, `\nBanned marketing copy found:\n${violations.join('\n')}\n`).toEqual([]);
  });
});
