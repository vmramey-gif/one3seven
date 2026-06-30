/**
 * Generate supabase/seed/cela_tier_update.sql from the prioritized CSV.
 * LOCAL ONLY — reads CSV, writes SQL. No DB, no secrets.
 *
 *   node scripts/genCelaTierUpdateSql.mjs [path/to/prioritized.csv]
 *
 * Adds a `tier` column (smallint 1-4) to crm_firms and sets it per attorney.
 * The 4 call-angle/objection templates live in code (TIER_PLAYS), not per-row.
 * Run ONCE in the Supabase SQL editor after the firms are seeded.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2] || 'C:/Users/Fam/AppData/Local/Temp/one3seven_sales_pipeline_prioritized.csv';
const OUT = 'supabase/seed/cela_tier_update.sql';

// Minimal CSV parser (handles quoted fields with commas).
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch === '\r') { /* skip */ }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const rows = parseCsv(readFileSync(SRC, 'utf8')).filter((r) => r.length > 2);
const header = rows.shift();
const iAtt = header.indexOf('ATTORNEY');
const iTier = header.indexOf('TIER');

const byAttorney = new Map();
for (const r of rows) {
  const att = (r[iAtt] || '').trim();
  const m = (r[iTier] || '').match(/TIER\s*(\d)/i);
  if (att && m) byAttorney.set(att, Number(m[1]));
}

const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const values = [...byAttorney.entries()].map(([att, tier]) => `  (${lit(att)}, ${tier})`).join(',\n');

const sql = `-- CELA tier assignment — sets crm_firms.tier (1-4) by attorney name.
-- Run ONCE in the Supabase SQL editor AFTER cela_firms_seed.sql. Idempotent.
-- 4 call-angle/objection templates live in code (TIER_PLAYS), not per-row.

alter table public.crm_firms add column if not exists tier smallint;

with t (attorney_name, tier) as (
  values
${values}
)
update public.crm_firms c
set tier = t.tier
from t
where c.attorney_name = t.attorney_name;
`;

writeFileSync(OUT, sql);
console.log(`Wrote ${OUT} — ${byAttorney.size} attorneys tiered`);
const dist = [...byAttorney.values()].reduce((a, t) => ((a[t] = (a[t] || 0) + 1), a), {});
console.log('tier distribution:', JSON.stringify(dist));
