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
 * SCOPE — read this before trusting a clean result more than it warrants (external review,
 * 2026-08-12, correctly pushed back on an earlier overclaim here). This catches exactly one
 * textual shape: `current_user` referenced inside a `SECURITY DEFINER` function body, written in
 * a tracked migration file, using a `$$...$$`/`$tag$...$tag$`-delimited body. It does NOT catch:
 *   - `current_role` (same underlying risk, different keyword)
 *   - the check built via dynamic SQL / string concatenation instead of a literal `if` clause
 *   - a function created directly via the Supabase dashboard SQL editor instead of a migration
 *     (this is not hypothetical — the `profiles` auto-provisioning hook found live 2026-08-12
 *     was created exactly this way, outside any tracked migration)
 * A catalog-level check against the live database (enumerate every SECURITY DEFINER function via
 * pg_proc directly, not through this file) is the durable answer to the gaps above and is queued
 * in docs/one3seven-security-hardening-roadmap.md — this script is a fast, zero-cost tripwire for
 * the known textual pattern, not a substitute for that.
 *
 * Also worth being precise about: `current_user` genuinely, factually resolves to the function's
 * OWNER for the duration of a SECURITY DEFINER call — that's just how Postgres works, not a
 * judgment call. Whether that's a *bug* depends on what the check is being used for. In every
 * instance found in this codebase, it was being used to decide whether to bypass a caller-identity
 * authorization check — for that specific use, it is always wrong, because the owner identity has
 * nothing to do with who's actually calling. A function using `current_user` for something else
 * (e.g. owner-aware auditing/logging, not an authorization decision) would be a legitimate
 * exception — none exist in this codebase today, but if one is ever added intentionally, add it
 * to GRANDFATHERED below with a comment explaining why, not by weakening this check.
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
  // Fail closed, not open, on a tooling error. An earlier version of this treated a missing
  // migrations directory as "nothing to check, pass" — that's fine ONLY when the absence is
  // actually expected. In this repo it never is (supabase/migrations always exists at the repo
  // root); silently passing on any readdirSync error (wrong cwd, permissions, a CI checkout gone
  // wrong) would make the check worthless exactly when something is already broken. Correctly
  // flagged by external review, 2026-08-12: "scan/tool error should fail closed."
  let files;
  try {
    files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
  } catch (e) {
    console.error(`FAIL: could not read ${MIGRATIONS_DIR}: ${e instanceof Error ? e.message : e}`);
    console.error('This check refuses to silently pass when it cannot actually scan anything.');
    process.exit(1);
  }
  if (files.length === 0) {
    console.error(`FAIL: ${MIGRATIONS_DIR} exists but contains no .sql files — unexpected.`);
    process.exit(1);
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
