/**
 * Copy guardrails — automated verb test (public copy + rep scripts + AI prompts).
 *
 * Scans customer-facing AND internal-but-repeatable surfaces for banned copy so a UPL /
 * outcome-promise / trademark-overclaim / indefinite-pricing regression cannot ship. This is the
 * automated floor under docs/COPY_STYLE_GUIDE.md and docs/LANDING_PAGE_CHECKLIST.md — it does NOT
 * replace the human verb test or the attorney review; it makes the worst mistakes un-mergeable.
 *
 * Scope note (why these files): the 2026-07-13 legal sweep found the same overclaim that was fixed
 * on the public pages ALSO living in rep-facing scripts (crmReference) and the AI assistant prompt
 * (systemPrompt) — surfaces a marketing-only scan never saw. Those are now in scope.
 *
 * Two tiers:
 *  - HARD: phrases essentially never safe in any context.
 *  - NEGATABLE: unsafe *as a claim* but legitimate inside a disclaimer that negates them
 *    ("does not recommend, rank, or select attorneys", "it never concludes"). Flagged only when
 *    NOT preceded by a negation within a short window.
 *
 * FROZEN / allowlist convention: to write a banned phrase for the purpose of FORBIDDING it (a frozen
 * note, an anti-instruction), put it on a line that also contains the token `FROZEN` or `LEGAL-ALLOW`.
 * Any match on such a line is exempt. This is a deliberate, greppable escape hatch — NOT context
 * inference — so it stays durable as copy changes.
 *
 * If a check false-positives on genuinely safe copy, tighten the pattern here — never weaken the
 * copy to satisfy the test.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const SCANNED_FILES = [
  // public marketing
  'src/app/screens/SageMarketingPage.tsx',
  'src/app/screens/ForFirmsPage.tsx',
  'src/app/screens/BrandPreviewPage.tsx',
  'src/i18n/i18n.tsx',
  // demo / semi-public product surfaces
  'src/app/screens/DemoApp.tsx',
  'src/app/screens/IntakeReviewScreen.tsx',
  // rep-facing scripts + AI-facing prompts (found leaking in the 2026-07-13 sweep)
  'src/app/constants/crmReference.ts',
  'supabase/functions/chat-assistant/systemPrompt.ts',
];

// Never safe, in any context.
const HARD: { label: string; re: RegExp }[] = [
  // outcome / money
  { label: 'outcome: maximize', re: /\bmaximi[sz]e\b/gi },
  { label: 'outcome: recover more', re: /\brecover more\b/gi },
  { label: 'outcome: better outcome(s)', re: /\bbetter outcomes?\b/gi },
  { label: 'outcome: fewer denials', re: /\bfewer denials\b/gi },
  { label: 'outcome: get you a bigger/more settlement etc.', re: /\bget you (a bigger|more|the) (settlement|payout|money|recovery|compensation|result|deal|award)\b/gi },
  { label: 'outcome: faster/higher settlement or payout', re: /\b(faster|higher|bigger) (settlement|payout|damages)\b/gi },
  // trademark / gov-endorsement (pattern-based, not just the literal frozen string)
  { label: 'trademark: California/gov-approved', re: /\bcalifornia[-\s]?approved\b|\b(state|government)[-\s]?(adopted|approved|endorsed)\b/gi },
  { label: 'gov-endorsement: adopted/approved statewide or for agencies', re: /\b(adopted|approved|endorsed|partnered)\b[^.\n]{0,32}\b(statewide|state agencies|(its )?(own )?agencies)\b/gi },
  { label: 'gov-endorsement: CA/Newsom adopted Claude/Anthropic', re: /\b(california|the state|government|newsom)\b[^.\n]{0,28}\b(adopted|approved|endorsed)\b[^.\n]{0,28}\b(claude|anthropic)\b/gi },
  { label: 'trademark: Anthropic partner/certified/endorsed', re: /\b(certified|endorsed|partnered?) (by|with) anthropic\b|\banthropic[-\s](certified|endorsed|partner)\b/gi },
  // indefinite pricing
  { label: 'pricing: locked for life', re: /\blocked (in )?for life\b/gi },
  { label: 'pricing: lifetime/forever pricing', re: /\b(lifetime|for life|forever|grandfathered forever)\b[^.\n]{0,20}\bpric/gi },
  { label: 'pricing: pricing ... for life/forever', re: /\bpric\w*[^.\n]{0,20}\b(for life|forever|lifetime)\b/gi },
  // unsubstantiated time-savings metric (hours range, or savings verb + hours/minutes)
  { label: 'metric: unsubstantiated hours range', re: /\b\d+\s*[–-]\s*\d+\s*(hours|hrs)\b/gi },
  { label: 'metric: normally takes / saves N hours', re: /\b(normally|usually) takes\b[^.\n]{0,18}\b\d+\s*(hours|hrs|minutes|mins)\b|\b(saves?|save you|cut[s]?)\b[^.\n]{0,18}\b\d+\s*(hours|hrs|minutes|mins)\b/gi },
  // security
  { label: 'security: independently verified', re: /\bindependently verified\b/gi },
  { label: 'security: SOC 2', re: /\bSOC[-\s]?2\b/gi },
  { label: 'security: penetration tested', re: /\bpen(etration)?[-\s]?tested\b/gi },
];

// Unsafe as a *claim*; fine when negated (disclaimers). Flagged only if NOT negated nearby.
const NEGATABLE: { label: string; re: RegExp }[] = [
  { label: 'conclusion: you have a case/claim', re: /\byou (have|may have|might have) an? (case|claim)\b/gi },
  { label: 'conclusion: strong/weak case/claim/evidence', re: /\b(strong|weak) (case|claim|evidence)\b/gi },
  { label: 'conclusion: case scoring', re: /\bcase scoring\b/gi },
  { label: 'conclusion: claim value/valuation', re: /\bclaim[-\s]valuation\b|\bclaim[-\s]value\b/gi },
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
// Deliberate escape hatch: a line marked FROZEN/LEGAL-ALLOW may quote a banned phrase to forbid it.
const ALLOW = /\b(FROZEN|LEGAL-ALLOW)\b/;
// Anti-instruction format: a line that FORBIDS a phrase (guardrail lists in rep scripts / AI prompts)
// quotes the banned words on purpose. This is a designated, greppable format — not intent inference.
const ANTI = /\bnever (say|assert|claim|state|imply|use|overclaim)\b|\bdo(es)? not (say|answer|assert|claim|use|imply|invent|draw|provide|evaluate|determine)\b|\bdon'?t (say|assert|claim|use|draw)\b|\bnot safe\b|\bbanned\b|acceptable:|objection:/i;

function lineOf(text: string, index: number): string {
  const start = text.lastIndexOf('\n', index) + 1;
  let end = text.indexOf('\n', index);
  if (end === -1) end = text.length;
  return text.slice(start, end);
}
function exempt(line: string): boolean {
  return ALLOW.test(line) || ANTI.test(line);
}
function isNegated(text: string, index: number): boolean {
  return NEGATION.test(text.slice(Math.max(0, index - 48), index));
}

function scan(text: string): { label: string; snippet: string }[] {
  const hits: { label: string; snippet: string }[] = [];
  const snippetAt = (i: number) => text.slice(Math.max(0, i - 30), i + 40).replace(/\s+/g, ' ').trim();

  for (const { label, re } of HARD) {
    for (const m of text.matchAll(re)) {
      const i = m.index ?? 0;
      if (exempt(lineOf(text, i))) continue; // frozen note or anti-instruction — exempt
      hits.push({ label, snippet: snippetAt(i) });
    }
  }
  for (const { label, re } of NEGATABLE) {
    for (const m of text.matchAll(re)) {
      const i = m.index ?? 0;
      if (exempt(lineOf(text, i))) continue;
      if (isNegated(text, i)) continue;
      hits.push({ label, snippet: snippetAt(i) });
    }
  }
  return hits;
}

describe('copy guardrails (automated verb test)', () => {
  it('all scanned files still exist (guardrail cannot be bypassed by renaming)', () => {
    for (const rel of SCANNED_FILES) {
      expect(existsSync(ROOT + rel), `missing scanned file: ${rel}`).toBe(true);
    }
  });

  it('contains no banned outcome / conclusion / trademark / pricing / metric copy', () => {
    const violations: string[] = [];
    for (const rel of SCANNED_FILES) {
      const full = ROOT + rel;
      if (!existsSync(full)) continue;
      const text = readFileSync(full, 'utf8');
      for (const hit of scan(text)) {
        violations.push(`${rel} — [${hit.label}] …${hit.snippet}…`);
      }
    }
    expect(violations, `\nBanned copy found:\n${violations.join('\n')}\n`).toEqual([]);
  });
});
