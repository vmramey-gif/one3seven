#!/usr/bin/env node
/**
 * Accuracy gauntlet — runs real synthetic cases through the ACTUAL production extraction
 * pipeline (extract-document-facts + get-intake-intelligence, the same edge functions the real
 * app calls) and asserts the output against known ground truth baked into each case's fixtures.
 *
 * WHY THIS EXISTS (2026-08-20, engineering stabilization sprint PR 3): the timeline/organization
 * engine (evidenceMappedTimelineService.ts, perFileOrganizationService.ts — PR 4's target) has a
 * real history of subtle regressions (wrong dates, phantom events, mislabeled titles) that unit
 * tests don't catch, because unit tests exercise code paths, not end-to-end accuracy against real
 * document content. This harness is the thing that catches that class of bug. Before this
 * commit, four "gauntlets" like this existed only as scratch files rebuilt from memory each
 * session, never committed, never repeatable. This is the first one actually checked in.
 *
 * HONEST SCOPE, not a silent claim of parity with what a prior session's memory described:
 *   - 4 synthetic personas (Delgado/Nakamura/Osei/Cho) with real fixture PDFs, committed here.
 *   - NOT included: the real "Francis" case (its source documents were never in this repo to
 *     begin with — real, not synthetic) and the firm-side / messy-input gauntlets (their fixture
 *     source material did not survive between sessions, only empty directory shells did). Rebuild
 *     those as a separate, deliberate effort if/when needed — do not assume they're covered here.
 *   - Each RESULT.json a prior session generated was raw pipeline output with NO automated
 *     scoring — "76/76 passed" was a human reading that JSON and judging it correct, not a real
 *     assertion suite. This script replaces that with real machine-checked assertions grounded in
 *     the exact ground truth baked into scripts/gauntlet-fixtures/*\/  (see the *.mjs generators
 *     alongside the fixtures for the literal source facts each case's documents state).
 *
 * SAFETY (same pattern as scripts/rls-firm-isolation-test.mjs — read that file's header too):
 *   - Runs ONLY against a Supabase project you point it at via env vars. No creds -> SKIPS.
 *   - REFUSES the known production project ref outright, no override flag. This harness creates
 *     real throwaway accounts and makes real, BILLED Anthropic API calls every run — that has no
 *     business happening against the app real workers use. Point it at a staging project.
 *   - Cleans up every seeded row + auth user in a `finally` block, even on failure/crash.
 *
 * RUNNING:
 *   SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY must point at a
 *   NON-production project (e.g. one3seven-staging) that has extract-document-facts and
 *   get-intake-intelligence deployed, and a real ANTHROPIC_API_KEY secret set (extraction calls
 *   the real Claude API — this is what actually costs money per run, be deliberate about when
 *   you run this, not on every save).
 *     npm run gauntlet
 *   Keep a case's seeded data around for manual inspection instead of cleaning up:
 *     GAUNTLET_KEEP=1 npm run gauntlet
 */
import { createClient } from '@supabase/supabase-js';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';

const URL = process.env.SUPABASE_TEST_URL?.trim();
const ANON = process.env.SUPABASE_TEST_ANON_KEY?.trim();
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY?.trim();
const PROD_REF = 'ebgkomrujmrkpetcdbgp';
const KEEP = process.env.GAUNTLET_KEEP === '1';

if (!URL || !ANON || !SERVICE) {
  console.log('\n[gauntlet] SKIPPED — test Supabase credentials not set');
  console.log('[gauntlet] Set SUPABASE_TEST_URL / _ANON_KEY / _SERVICE_ROLE_KEY (a staging project) to run.\n');
  process.exit(0);
}
if (URL.includes(PROD_REF)) {
  console.error('\n[gauntlet] REFUSING to run against the production project. This makes real billed');
  console.error('[gauntlet] Anthropic API calls and creates real accounts — use a staging project. No override exists on purpose.\n');
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.join(__dirname, 'gauntlet-fixtures');

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const failures = [];
const passes = [];
const fail = (caseId, msg) => { failures.push(`${caseId}: ${msg}`); console.error(`  ✗ [${caseId}] ${msg}`); };
const pass = (caseId, msg) => { passes.push(`${caseId}: ${msg}`); console.log(`  ✓ [${caseId}] ${msg}`); };

function assertContains(caseId, label, actual, expectedSubstring) {
  const a = (actual ?? '').toString();
  if (a.toLowerCase().includes(expectedSubstring.toLowerCase())) pass(caseId, `${label}: contains "${expectedSubstring}"`);
  else fail(caseId, `${label}: expected to contain "${expectedSubstring}", got ${JSON.stringify(actual)}`);
}

function assertDateNear(caseId, label, actual, expectedISODate, toleranceDays = 1) {
  const a = actual ? new Date(actual) : null;
  const e = new Date(expectedISODate);
  if (!a || isNaN(a.getTime())) { fail(caseId, `${label}: expected a date near ${expectedISODate}, got ${JSON.stringify(actual)}`); return; }
  const diffDays = Math.abs(a.getTime() - e.getTime()) / 86_400_000;
  if (diffDays <= toleranceDays) pass(caseId, `${label}: ${actual} is within ${toleranceDays}d of expected ${expectedISODate}`);
  else fail(caseId, `${label}: ${actual} is ${diffDays.toFixed(1)}d from expected ${expectedISODate} (tolerance ${toleranceDays}d)`);
}

function assertNull(caseId, label, actual) {
  if (actual === null || actual === undefined) pass(caseId, `${label}: correctly null (no fabrication)`);
  else fail(caseId, `${label}: expected null, got ${JSON.stringify(actual)} — likely hallucinated`);
}

function assertIntervalDays(caseId, label, intelligence, expectedDays, toleranceDays = 1) {
  const found = (intelligence.timingIntervals ?? []).find((t) => t.label === label);
  if (!found) { fail(caseId, `timingIntervals["${label}"]: not present at all, expected ~${expectedDays}d`); return; }
  const diff = Math.abs(found.days - expectedDays);
  if (diff <= toleranceDays) pass(caseId, `timingIntervals["${label}"]: ${found.days}d matches expected ~${expectedDays}d`);
  else fail(caseId, `timingIntervals["${label}"]: ${found.days}d, expected ~${expectedDays}d (tolerance ${toleranceDays}d)`);
}

function assertMinCount(caseId, label, actualLength, minExpected) {
  if ((actualLength ?? 0) >= minExpected) pass(caseId, `${label}: ${actualLength} >= ${minExpected}`);
  else fail(caseId, `${label}: only ${actualLength}, expected at least ${minExpected}`);
}

// ── The 4 cases: fixtures + the ground truth their generator scripts baked into the documents ──
const CASES = [
  {
    id: 'case-a-delgado',
    personaLabel: 'Marcus Delgado',
    workerStory:
      "I worked at Bright Horizon Logistics as a warehouse coordinator. I was working way more than 40 hours a week but only getting paid straight time. I emailed HR about it and two weeks later I was fired for 'restructuring.' My final check didn't include the overtime I was owed and no PTO payout either.",
    assert(caseId, intel) {
      assertContains(caseId, 'confirmedEmployer', intel.confirmedEmployer, 'Bright Horizon Logistics');
      assertDateNear(caseId, 'confirmedComplaintDate', intel.confirmedComplaintDate, '2025-06-09');
      assertDateNear(caseId, 'confirmedTerminationDate', intel.confirmedTerminationDate, '2025-06-24');
      assertDateNear(caseId, 'confirmedStartDate', intel.confirmedStartDate, '2025-03-17');
      assertIntervalDays(caseId, 'Termination', intel, 15);
    },
  },
  {
    id: 'case-b-nakamura',
    personaLabel: 'Priya Nakamura',
    workerStory:
      "I was an assistant store manager at Coastal Retail Group. I complained to HR about how my manager Diego was treating me. After that my hours got cut and then I got written up and then fired about five weeks later for 'performance.'",
    assert(caseId, intel) {
      assertContains(caseId, 'confirmedEmployer', intel.confirmedEmployer, 'Coastal Retail Group');
      assertDateNear(caseId, 'confirmedComplaintDate', intel.confirmedComplaintDate, '2025-04-02');
      assertDateNear(caseId, 'confirmedTerminationDate', intel.confirmedTerminationDate, '2025-05-06');
      assertIntervalDays(caseId, 'Termination', intel, 34);
    },
  },
  {
    id: 'case-c-osei',
    personaLabel: 'David Osei',
    workerStory:
      'I worked 12-hour shifts as a patient care tech at Vantage Health Partners for almost a year. I never got meal or rest break premium pay even though I was often too short-staffed to take my breaks.',
    assert(caseId, intel) {
      assertContains(caseId, 'confirmedEmployer', intel.confirmedEmployer, 'Vantage Health Partners');
      // No separation happened in this case -- the harness's real value here is proving the
      // engine reports "not confirmed" rather than inventing a termination date that isn't there.
      assertNull(caseId, 'confirmedTerminationDate', intel.confirmedTerminationDate);
      assertMinCount(caseId, 'wageFacts', intel.wageFacts?.length, 10);
    },
  },
  {
    id: 'case-d-cho',
    personaLabel: 'Elena Cho',
    workerStory:
      'I work at Meridian Business Solutions as an Accounts Payable Coordinator. My pay stubs show overtime hours every pay period but they get paid at my regular rate, not time-and-a-half.',
    assert(caseId, intel) {
      assertContains(caseId, 'confirmedEmployer', intel.confirmedEmployer, 'Meridian Business Solutions');
      assertDateNear(caseId, 'confirmedStartDate', intel.confirmedStartDate, '2026-01-26');
      assertNull(caseId, 'confirmedTerminationDate', intel.confirmedTerminationDate);
      assertMinCount(caseId, 'wageFacts', intel.wageFacts?.length, 4);
    },
  },
];

const seeded = { userIds: [], intakeIds: [], firmUserIds: [], firmProfileIds: [] };

async function runCase(kase) {
  const caseId = kase.id;
  const stamp = Date.now();
  const email = `gauntlet-${caseId}-${stamp}@one3seven-gauntlet.invalid`;
  const password = crypto.randomBytes(12).toString('hex');

  console.log(`\n[${caseId}] creating test worker ${email}`);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (createErr) { fail(caseId, `createUser failed: ${createErr.message}`); return; }
  const userId = created.user.id;
  seeded.userIds.push(userId);

  const { error: profileErr } = await admin.from('profiles').upsert({ id: userId, email, full_name: kase.personaLabel, role: 'worker' });
  if (profileErr) { fail(caseId, `profiles upsert failed: ${profileErr.message}`); return; }

  const intakeNumber = `GNT-${caseId.toUpperCase()}-${stamp}`;
  const { data: intake, error: intakeErr } = await admin
    .from('intakes')
    .insert({
      worker_id: userId,
      intake_number: intakeNumber,
      status: 'draft',
      workflow_status: 'Upload Complete',
      submission_channel: null,
      worker_metadata: { workerStory: kase.workerStory, fullName: kase.personaLabel },
    })
    .select('id')
    .single();
  if (intakeErr) { fail(caseId, `intakes insert failed: ${intakeErr.message}`); return; }
  const intakeId = intake.id;
  seeded.intakeIds.push(intakeId);
  console.log(`[${caseId}] intake ${intakeNumber} (${intakeId})`);

  const dir = path.join(FIXTURES_DIR, caseId);
  const files = readdirSync(dir).filter((f) => f.endsWith('.pdf')).sort();
  for (const fname of files) {
    const bytes = readFileSync(path.join(dir, fname));
    const storagePath = `${userId}/${intakeId}/${fname}`;
    const { error: upErr } = await admin.storage.from('intake-files').upload(storagePath, bytes, { contentType: 'application/pdf', upsert: false });
    if (upErr) { fail(caseId, `storage upload failed for ${fname}: ${upErr.message}`); continue; }
    const { error: rowErr } = await admin.from('uploaded_files').insert({
      intake_id: intakeId, worker_id: userId, file_name: fname, file_path: storagePath,
      file_type: 'application/pdf', file_size: bytes.byteLength, content_hash: sha256(bytes),
    });
    if (rowErr) fail(caseId, `uploaded_files insert failed for ${fname}: ${rowErr.message}`);
  }
  console.log(`[${caseId}] uploaded ${files.length} files`);

  const anonClient = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: signIn, error: signInErr } = await anonClient.auth.signInWithPassword({ email, password });
  if (signInErr) { fail(caseId, `sign-in failed: ${signInErr.message}`); return; }
  const jwt = signIn.session.access_token;

  // Drain the batch-extraction loop until every file has been processed (mirrors the real app's
  // client-side resumable loop — extract-document-facts self-limits to a wall-clock budget per call).
  let remaining = 1;
  let round = 0;
  while (remaining > 0 && round < 10) {
    round++;
    const resp = await fetch(`${URL}/functions/v1/extract-document-facts`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', apikey: ANON },
      body: JSON.stringify({ intake_id: intakeId, batch: true }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) { fail(caseId, `extract-document-facts round ${round} returned ${resp.status}: ${JSON.stringify(json)}`); return; }
    remaining = json.remaining ?? 0;
    console.log(`[${caseId}] extract round ${round}: processed=${json.processed} failed=${json.failed} remaining=${remaining}`);
    if (json.results) console.log(`[${caseId}] results:`, JSON.stringify(json.results, null, 2));
  }
  if (remaining > 0) { fail(caseId, `extraction never finished after ${round} rounds (${remaining} still remaining)`); return; }

  // get-intake-intelligence is FIRM-only (requires an intake_routes row at route_status =
  // 'full_access' for the caller's firm) -- it does not accept the worker's own JWT at all, even
  // for their own intake. Seed a throwaway firm with full_access to read it back, mirroring what
  // a real firm review actually requires.
  const firmEmail = `gauntlet-firm-${caseId}-${stamp}@one3seven-gauntlet.invalid`;
  const firmPassword = crypto.randomBytes(12).toString('hex');
  const { data: firmCreated, error: firmCreateErr } = await admin.auth.admin.createUser({ email: firmEmail, password: firmPassword, email_confirm: true });
  if (firmCreateErr) { fail(caseId, `firm createUser failed: ${firmCreateErr.message}`); return; }
  const firmUserId = firmCreated.user.id;
  seeded.firmUserIds.push(firmUserId);

  const { data: firmProfile, error: firmProfileErr } = await admin
    .from('firm_profiles')
    .insert({ profile_id: firmUserId, firm_name: `Gauntlet Firm (${caseId})`, firm_code: `GNT-${caseId}-${stamp}`.toUpperCase() })
    .select('id')
    .single();
  if (firmProfileErr) { fail(caseId, `firm_profiles insert failed: ${firmProfileErr.message}`); return; }
  seeded.firmProfileIds.push(firmProfile.id);

  const { error: routeErr } = await admin
    .from('intake_routes')
    .insert({ intake_id: intakeId, firm_id: firmProfile.id, route_status: 'full_access' });
  if (routeErr) { fail(caseId, `intake_routes insert failed: ${routeErr.message}`); return; }

  const firmAnonClient = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: firmSignIn, error: firmSignInErr } = await firmAnonClient.auth.signInWithPassword({ email: firmEmail, password: firmPassword });
  if (firmSignInErr) { fail(caseId, `firm sign-in failed: ${firmSignInErr.message}`); return; }
  const firmJwt = firmSignIn.session.access_token;

  const intelResp = await fetch(`${URL}/functions/v1/get-intake-intelligence`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${firmJwt}`, 'Content-Type': 'application/json', apikey: ANON },
    body: JSON.stringify({ intake_id: intakeId }),
  });
  const intelJson = await intelResp.json().catch(() => ({}));
  if (!intelResp.ok) { fail(caseId, `get-intake-intelligence returned ${intelResp.status}: ${JSON.stringify(intelJson)}`); return; }
  if (!intelJson.hasFacts || !intelJson.intelligence) { fail(caseId, `get-intake-intelligence returned no intelligence (hasFacts=${intelJson.hasFacts})`); return; }

  kase.assert(caseId, intelJson.intelligence);
}

async function cleanup() {
  if (KEEP) {
    console.log('\n[gauntlet] GAUNTLET_KEEP=1 set — leaving seeded data in place for inspection.');
    console.log('[gauntlet] userIds:', seeded.userIds);
    console.log('[gauntlet] intakeIds:', seeded.intakeIds);
    console.log('[gauntlet] firmUserIds:', seeded.firmUserIds);
    console.log('[gauntlet] firmProfileIds:', seeded.firmProfileIds);
    return;
  }
  for (const id of seeded.intakeIds) {
    await admin.from('intake_routes').delete().eq('intake_id', id);
    await admin.from('file_text_extractions').delete().eq('intake_id', id);
    await admin.from('uploaded_files').delete().eq('intake_id', id);
    await admin.from('intakes').delete().eq('id', id);
  }
  for (const id of seeded.firmProfileIds) {
    await admin.from('firm_profiles').delete().eq('id', id);
  }
  for (const id of seeded.userIds) {
    await admin.storage.from('intake-files').list(id).then(async ({ data }) => {
      if (data?.length) await admin.storage.from('intake-files').remove(data.map((f) => `${id}/${f.name}`)).catch(() => {});
    }).catch(() => {});
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
  for (const id of seeded.firmUserIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

try {
  for (const kase of CASES) {
    try {
      await runCase(kase);
    } catch (e) {
      fail(kase.id, `harness error: ${e.message}`);
    }
  }
} finally {
  await cleanup().catch((e) => console.error('[gauntlet] cleanup error:', e.message));
}

console.log(`\n[gauntlet] ${passes.length} passed, ${failures.length} failed.`);
if (failures.length) {
  console.error('\n[gauntlet] FAILED:');
  failures.forEach((f) => console.error(`  - ${f}`));
  process.exit(1);
}
console.log('[gauntlet] PASSED — all 4 cases matched their known ground truth.\n');
process.exit(0);
