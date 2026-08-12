#!/usr/bin/env node
/**
 * Static guard against a specific, recurring Postgres footgun: a `security definer` function
 * that branches on `current_user` to decide whether to bypass its own checks.
 *
 * Inside a SECURITY DEFINER function, `current_user` resolves to the function's OWNER for the
 * duration of the call — never the actual caller. A pattern like
 *   if current_user in ('service_role', 'supabase_admin', 'postgres') then return new; end if;
 * is therefore unconditionally true for every invocation, silently disabling whatever check it
 * was meant to gate. This exact bug shipped twice in this codebase (profiles' privilege-lock
 * trigger, 2026-07-27; firm_profiles' sibling, 2026-08-09) and went undetected for weeks because
 * nothing but a live attack attempt could reveal it — see security_curriculum.md finding #8 and
 * docs/security-change-checklist.md.
 *
 * This check requires no database connection: it's a pure text scan of migration files, so it
 * runs on every PR with zero infrastructure dependency (unlike the RLS isolation harnesses,
 * which need a staging Supabase project).
 *
 * Scope note: this flags any `security definer` function body that also references
 * `current_user`, which is the exact shape of the known-bad pattern. A function that legitimately
 * needs SECURITY DEFINER for an unrelated reason (e.g. is_founder(), which keys off auth.uid(),
 * not current_user) will not match and is not flagged.
 *
 * IMPORTANT — why GRANDFATHERED exists: migrations are an append-only log of what was actually
 * run against the database; a file already applied to production can never be edited or deleted
 * retroactively (rewriting it wouldn't change what already ran, and Supabase's migration
 * tracking assumes immutable history). The two files below shipped the actual bug and are kept
 * verbatim as the historical record — they are fully neutralized by later migrations
 * (20260812140000 replaces both functions body-for-body). Without this allowlist, this check
 * would fail on every single future PR forever, since it can never "fix" history — that would
 * make the check something people learn to ignore, which defeats the point. Any NEW file hitting
 * this pattern still fails the build. Do not add to this list without a superseding migration
 * that actually removes the current_user bypass, committed in the same change.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations');

const GRANDFATHERED = new Set([
  '20260727120000_fix_profiles_privilege_escalation.sql',
  '20260809140000_firm_profiles_privilege_escalation.sql',
  '20260812120000_profiles_insert_privilege_lock.sql',
]);

function findFunctionBodies(sql) {
  // Matches `create [or replace] function ... security definer ... as $$ ... $$` (or $tag$),
  // case-insensitively, tolerant of `security definer` appearing before or after other function
  // attributes (language, stable, set search_path, etc.) in either order.
  const bodies = [];
  const fnRegex = /create\s+(?:or\s+replace\s+)?function\s+[\s\S]*?\$(\w*)\$([\s\S]*?)\$\1\$/gi;
  let match;
  while ((match = fnRegex.exec(sql)) !== null) {
    const fullDeclaration = match[0];
    const body = match[2];
    if (/security\s+definer/i.test(fullDeclaration)) {
      bodies.push(body);
    }
  }
  return bodies;
}

function main() {
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  } catch {
    console.log('No supabase/migrations directory found — nothing to check.');
    return;
  }

  const violations = [];
  const grandfatheredHits = [];
  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    for (const body of findFunctionBodies(sql)) {
      if (/current_user/i.test(body)) {
        (GRANDFATHERED.has(file) ? grandfatheredHits : violations).push(file);
      }
    }
  }

  if (grandfatheredHits.length > 0) {
    console.log(
      `(${new Set(grandfatheredHits).size} grandfathered historical file(s) skipped — ` +
        'already superseded by a later fix migration, kept only as an immutable record.)'
    );
  }

  if (violations.length > 0) {
    console.error('FAIL: SECURITY DEFINER function body references current_user in:');
    for (const f of [...new Set(violations)]) console.error(`  - ${f}`);
    console.error(
      '\ncurrent_user inside SECURITY DEFINER always resolves to the function owner, never the ' +
        'caller — this silently disables role-based bypass checks. Use session_user, drop ' +
        'SECURITY DEFINER if the function does not need it (most privilege-lock triggers do not), ' +
        'or key the check off auth.uid()/auth.role() instead. See security_curriculum.md finding #8.'
    );
    process.exit(1);
  }

  console.log('OK: no SECURITY DEFINER function references current_user.');
}

main();
