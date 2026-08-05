import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SP = 'C:/Users/Fam/AppData/Local/Temp/claude/C--Users-Fam-One3Seven---MVP-Prototype--1-/1519a702-8c1d-451a-9f82-dc043427955f/scratchpad';
const SLUG = 'px7k4m9t2e8b3a6';
const OUT = resolve('.', 'public', SLUG);
mkdirSync(OUT, { recursive: true });

const MAP = [
  ['pricing-sheet.html', 'sheet.html'],
  ['pricing-scenarios.html', 'postures.html'],
  ['pricing-examples.html', 'examples.html'],
  ['spend-map.html', 'spend.html'],
  ['savings-map.html', 'savings.html'],
  ['billing-card.html', 'billing.html'],
];

for (const [src, dst] of MAP) {
  let c = readFileSync(resolve(SP, src), 'utf8');
  let title = 'one3seven';
  const m = c.match(/^<title>([\s\S]*?)<\/title>/);
  if (m) { title = m[1]; c = c.replace(m[0], ''); }
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${title}</title></head><body>${c}</body></html>`;
  writeFileSync(resolve(OUT, dst), doc);
  console.log('wrote', dst, '(' + (doc.length / 1024).toFixed(0) + ' KB)');
}
console.log('slug:', SLUG);
