#!/usr/bin/env node
/**
 * Static guard against a real, live incident found 2026-08-12: a trigger's arguments hardcoded
 * the project's actual `service_role` key (and a separate webhook secret) in plaintext, directly
 * in a migration file (and therefore in the live database catalog too). Not catchable by a
 * normal git-history secrets scanner (task #12, this session) because it was never framed as
 * "an API key in a config file" — it was a string literal argument to a trigger. See
 * security_curriculum.md finding #9.
 *
 * This scans every migration file for secret-shaped strings: JWTs (the exact shape of Supabase's
 * legacy anon/service_role keys), long hex strings (the shape of the webhook secret actually
 * found), and common vendor secret prefixes. It is a pattern-matcher, not a semantic understanding
 * of "is this actually sensitive" — false positives are possible and get grandfathered with a
 * reason, same pattern as check-security-definer-current-user.mjs. False negatives are more
 * likely than false positives here (a secret with an unrecognized shape won't be caught) — this
 * is a tripwire for the known incident shape, not a complete secrets-detection system. A live
 * catalog sweep (checking what's actually installed, not just tracked migration files) is the
 * complementary check for objects created outside migrations — see the one-time sweep run
 * 2026-08-12 and docs/one3seven-security-hardening-roadmap.md for the case for making that
 * recurring, not just a one-off.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

// Grandfathered: files where a match is confirmed to be either (a) already remediated by a
// later migration and kept only as immutable history, or (b) a genuine false positive with a
// stated reason. Do not add to this list without one of those two justifications in the commit.
//
// Note: the actual incident this check exists for (the hardcoded service_role key) was NEVER in
// a tracked migration at all -- confirmed 2026-08-12 via `grep -rl "notify-pilot-lead"
// supabase/migrations/*.sql`, which returned nothing until tonight's own remediation/discussion
// files. It was created directly via the Supabase dashboard, like the profiles auto-provisioning
// hook. So there is nothing to grandfather for that incident specifically -- this list starts
// empty and should stay that way unless a real, reviewed false positive shows up.
const GRANDFATHERED = new Set([]);

const PATTERNS = [
  { name: 'JWT (three base64url segments)', regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { name: 'long hex string (32+ chars, likely a secret/token)', regex: /\b[0-9a-f]{32,}\b/i },
  { name: 'Supabase secret-style key', regex: /\bsb_secret_[A-Za-z0-9]{10,}/ },
  { name: 'Stripe live/test secret key', regex: /\bsk_(live|test)_[A-Za-z0-9]{10,}/ },
  { name: 'Stripe webhook secret', regex: /\bwhsec_[A-Za-z0-9]{10,}/ },
  { name: 'GitHub token', regex: /\bgh[pousr]_[A-Za-z0-9]{20,}/ },
  { name: 'AWS access key ID', regex: /\bAKIA[0-9A-Z]{16}\b/ },
];

function main() {
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  } catch (e) {
    console.error(`FAIL: could not read ${MIGRATIONS_DIR}: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`FAIL: ${MIGRATIONS_DIR} exists but contains no .sql files -- unexpected.`);
    process.exit(1);
  }

  const violations = [];
  const grandfatheredHits = [];
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    for (const { name, regex } of PATTERNS) {
      const match = sql.match(regex);
      if (match) {
        const hit = { file, pattern: name, snippet: match[0].slice(0, 24) + '...' };
        (GRANDFATHERED.has(file) ? grandfatheredHits : violations).push(hit);
      }
    }
  }

  if (grandfatheredHits.length > 0) {
    console.log(
      `(${new Set(grandfatheredHits.map((h) => h.file)).size} grandfathered historical file(s) skipped.)`
    );
  }

  if (violations.length > 0) {
    console.error('FAIL: possible hardcoded secret(s) found in migration files:');
    for (const v of violations) console.error(`  - ${v.file}: ${v.pattern} (${v.snippet})`);
    console.error(
      '\nIf this is a genuine secret, remove it from the migration and read it from Vault or an ' +
        'edge function env var at runtime instead. If this is a false positive, add the filename ' +
        'to GRANDFATHERED in this script with a one-line reason -- do not weaken the pattern to ' +
        'work around a single false positive.'
    );
    process.exit(1);
  }

  console.log('OK: no secret-shaped strings found in migration files.');
}

main();
