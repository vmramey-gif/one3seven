/**
 * Generate supabase/seed/cela_firms_seed.sql from the CELA JSON export.
 * LOCAL ONLY — reads a JSON file and writes a .sql file. No DB, no secrets.
 *
 *   node scripts/genCelaSeedSql.mjs [path/to/cela_firms_seed.json]
 *
 * The emitted SQL is run ONCE in the Supabase SQL editor (service role bypasses RLS).
 * It dedupes against existing crm_firms by (attorney_name, phone) and is safe to re-run.
 * focus_areas is joined to a comma-separated string to match the scalar TEXT column.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SRC = process.argv[2] || 'C:/Users/Fam/AppData/Local/Temp/cela_firms_seed.json';
const OUT = 'supabase/seed/cela_firms_seed.sql';

const rows = JSON.parse(readFileSync(SRC, 'utf8'));
const lit = (v) => (v === null || v === undefined || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

const tuples = rows.map((r) => {
  const focus = Array.isArray(r.focus_areas) ? r.focus_areas.join(', ') : (r.focus_areas ?? null);
  const email = r.email ? lit(r.email) : 'null::text'; // pin column type (all emails null)
  return `  (${lit(r.name)}, ${lit(r.attorney_name)}, ${lit(r.phone)}, ${email}, ${lit(r.website)}, ${lit(r.region)}, ${lit(r.priority)}, ${lit(focus)}, ${lit(r.source || 'CELA')}, 'target', ${lit(r.notes)})`;
}).join(',\n');

const sql = `-- CELA firm seed — ${rows.length} California employment attorneys (source: CELA directory).
-- Run ONCE in the Supabase SQL editor (service role bypasses RLS). Safe to re-run:
-- dedupes against existing crm_firms by (attorney_name, phone). focus_areas is a
-- comma-joined string to match the scalar TEXT column. All firms start at stage 'target'.

with v (name, attorney_name, phone, email, website, region, priority, focus_areas, source, stage, notes) as (
  values
${tuples}
)
insert into public.crm_firms (name, attorney_name, phone, email, website, region, priority, focus_areas, source, stage, notes)
select name, attorney_name, phone, email, website, region, priority, focus_areas, source, stage, notes
from v
where not exists (
  select 1 from public.crm_firms e
  where e.attorney_name is not distinct from v.attorney_name
    and e.phone is not distinct from v.phone
);
`;

writeFileSync(OUT, sql);
console.log(`Wrote ${OUT} — ${rows.length} firms`);
