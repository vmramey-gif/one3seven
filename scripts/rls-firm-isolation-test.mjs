#!/usr/bin/env node
/**
 * Firm-side isolation harness — proves the worker<->FIRM boundary and firm<->firm isolation.
 *
 * Companion to scripts/rls-isolation-test.mjs (worker<->worker only, by design — see that
 * file's header). This is the "firm-side attacker-matrix harness" both that script and
 * docs/rls-testing.md flagged as a not-yet-built gap. It proves the same class of thing that
 * script proves, but for the harder boundary: a firm with a route to ONE worker's intake must
 * never see ANOTHER firm's route, and must never see MORE than its route_status entitles it to.
 *
 * HOW IT WORKS
 *   1. Service-role client creates two workers (A, B) and two firms (FirmA, FirmB).
 *   2. Worker A gets one intake. FirmA gets a route to it at 'preview_sent'. FirmB gets NO route
 *      at all — FirmB is the pure cross-tenant control: it should read zero of anything below.
 *   3. At 'preview_sent', assert: FirmA can read the safe preview projection (firm_intake_preview)
 *      but NOTHING else — not the raw `intakes` row (worker_metadata must never reach a firm at
 *      any stage), not uploaded_files, not intake_summaries/timeline_events. FirmB reads zero of
 *      all of the above.
 *   4. Worker A signs in and calls the real `worker_approve_full_access` RPC (the actual
 *      production approval path, not a service-role shortcut) to escalate the route.
 *   5. At 'full_access', assert: FirmA can now read uploaded_files + intake_summaries +
 *      timeline_events, but STILL cannot read the raw `intakes` row. FirmB still reads zero of
 *      everything — the core cross-tenant assertion, now re-checked at the higher access stage.
 *   6. Regression checks: FirmA cannot self-escalate its OWN route back down/up via direct
 *      UPDATE outside the RPC; FirmA cannot self-elevate its OWN firm_profiles.plan_id.
 *   7. finally: every seeded row and all four users are deleted.
 *
 * COVERAGE (worker<->firm and firm<->firm)
 *   - intakes             firm must NEVER read this table directly, at any route_status
 *   - firm_intake_preview  firm may read (safe columns only) once ANY route exists
 *   - uploaded_files       firm may read only at route_status = 'full_access'
 *   - intake_summaries     firm may read only at route_status = 'full_access'
 *   - timeline_events      firm may read only at route_status = 'full_access'
 *   - intake_routes        firm may read/update its OWN route only; cannot set full_access itself
 *   - firm_profiles        firm may update its own name/contact fields; cannot self-elevate plan_id
 *   NOT here: storage.objects byte-level isolation (needs real file uploads — separate, heavier
 *   test if ever needed; the storage.objects RLS policy mirrors uploaded_files' route_status gate
 *   and was verified by static policy review, see the 2026-08-09 security-audit session).
 *
 * RUNNING — same credentials/guard pattern as rls-isolation-test.mjs:
 *     SUPABASE_TEST_URL / SUPABASE_TEST_ANON_KEY / SUPABASE_TEST_SERVICE_ROLE_KEY (non-prod)
 *   Then: npm run test:rls-firm
 *   No creds -> SKIPS (exit 0). Refuses the known prod ref unless RLS_TEST_ALLOW_PROD=1.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.SUPABASE_TEST_URL?.trim();
const ANON = process.env.SUPABASE_TEST_ANON_KEY?.trim();
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY?.trim();
const PROD_REF = 'ebgkomrujmrkpetcdbgp';

if (!URL || !ANON || !SERVICE) {
  console.log('\n[rls-firm-isolation] SKIPPED — test Supabase credentials not set');
  console.log('[rls-firm-isolation] Set SUPABASE_TEST_URL / _ANON_KEY / _SERVICE_ROLE_KEY (non-prod) to enforce.\n');
  process.exit(0);
}
if (URL.includes(PROD_REF) && process.env.RLS_TEST_ALLOW_PROD !== '1') {
  console.error('\n[rls-firm-isolation] REFUSING to run against the production project. Use a staging/test project.\n');
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

async function userClient(email, password) {
  const c = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

const failures = [];
const fail = (msg) => { failures.push(msg); console.error(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);
const assertRows = (rows, expected, label) => {
  const n = rows?.length ?? 0;
  return n === expected
    ? pass(`${label}: ${n} row(s) as expected`)
    : fail(`${label}: expected ${expected}, got ${n}`);
};
const assertDenied = (result, label) => {
  // A correct deny can surface as an error OR as zero rows, depending on whether Postgres
  // rejects the write outright or the RLS-filtered read simply returns nothing to update.
  if (result.error) return pass(`${label}: denied (${result.error.message})`);
  const affected = Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0);
  return affected === 0
    ? pass(`${label}: denied (0 rows affected)`)
    : fail(`LEAK ${label}: write succeeded — ${JSON.stringify(result.data)}`);
};

const seeded = { userIds: [], firmIds: [], intakeIds: [], routeIds: [] };

async function createUser(tag) {
  const email = `rls-firm-test-${tag}-${randomUUID()}@one3seven-rlstest.invalid`;
  const password = `Rls!${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${tag}) failed: ${error.message}`);
  seeded.userIds.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function createFirm(profileId, tag) {
  const { data, error } = await admin.from('firm_profiles').insert({
    profile_id: profileId,
    firm_name: `RLS Test Firm ${tag}`,
    firm_code: `RLSF${tag}${randomUUID().slice(0, 6).toUpperCase()}`,
    contact_email: `rls-firm-${tag}@one3seven-rlstest.invalid`,
  }).select('id').single();
  if (error) throw new Error(`createFirm(${tag}) failed: ${error.message}`);
  seeded.firmIds.push(data.id);
  return data.id;
}

async function seedIntake(workerId) {
  const { data, error } = await admin.from('intakes').insert({
    worker_id: workerId,
    intake_number: `RLSFTEST-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: 'draft',
    workflow_status: 'Upload Complete',
    worker_metadata: { workerStory: 'PRIVATE — must never reach a firm, at any route_status.' },
  }).select('id').single();
  if (error) throw new Error(`seed intake failed: ${error.message}`);
  seeded.intakeIds.push(data.id);
  return data.id;
}

async function seedRoute(intakeId, firmId, routeStatus) {
  const { data, error } = await admin.from('intake_routes').insert({
    intake_id: intakeId, firm_id: firmId, route_status: routeStatus,
  }).select('id').single();
  if (error) throw new Error(`seed route failed: ${error.message}`);
  seeded.routeIds.push(data.id);
  return data.id;
}

async function seedUploadedFile(intakeId, workerId) {
  const { error } = await admin.from('uploaded_files').insert({
    intake_id: intakeId, worker_id: workerId,
    file_name: 'rls-firm-harness.pdf', file_path: `${workerId}/${intakeId}/rls-firm-harness.pdf`,
    category: 'Uncategorized',
  });
  if (error) throw new Error(`seed uploaded_files failed: ${error.message}`);
}

async function seedSummary(intakeId) {
  const { error } = await admin.from('intake_summaries').insert({
    intake_id: intakeId, overview: 'RLS firm harness summary',
  });
  if (error) throw new Error(`seed intake_summaries failed: ${error.message}`);
}

async function seedTimelineEvent(intakeId) {
  const { error } = await admin.from('timeline_events').insert({
    intake_id: intakeId, event_date: '2026-01-10', title: 'RLS firm harness event',
    category: 'Uncategorized', ai_summary: '', worker_context: '',
  });
  if (error) throw new Error(`seed timeline_events failed: ${error.message}`);
}

/** Every table a firm might read for one intake, at whatever access stage currently applies. */
async function readAllAsFirm(client, intakeId) {
  return {
    intakesDirect: await client.from('intakes').select('id, worker_metadata').eq('id', intakeId),
    preview: await client.from('firm_intake_preview').select('id, intake_number').eq('id', intakeId),
    uploadedFiles: await client.from('uploaded_files').select('id').eq('intake_id', intakeId),
    summaries: await client.from('intake_summaries').select('id').eq('intake_id', intakeId),
    timeline: await client.from('timeline_events').select('id').eq('intake_id', intakeId),
  };
}

async function run() {
  console.log(`\n[rls-firm-isolation] target: ${URL}`);

  const workerA = await createUser('worker-a');
  const firmAOwner = await createUser('firm-a');
  const firmBOwner = await createUser('firm-b');

  const firmAId = await createFirm(firmAOwner.id, 'A');
  const firmBId = await createFirm(firmBOwner.id, 'B'); // no route to anything — pure control

  const intakeA = await seedIntake(workerA.id);
  const routeAtoA = await seedRoute(intakeA, firmAId, 'preview_sent');
  await seedUploadedFile(intakeA, workerA.id);
  await seedSummary(intakeA);
  await seedTimelineEvent(intakeA);

  const firmAClient = await userClient(firmAOwner.email, firmAOwner.password);
  const firmBClient = await userClient(firmBOwner.email, firmBOwner.password);
  const workerAClient = await userClient(workerA.email, workerA.password);

  // --- Stage 1: preview_sent ---
  console.log("\n--- STAGE: preview_sent (FirmA has a route, not yet approved) ---");
  {
    const a = await readAllAsFirm(firmAClient, intakeA);
    assertRows(a.intakesDirect.data, 0, 'FirmA→intakes (direct) at preview_sent — must be 0, worker_metadata never firm-visible');
    assertRows(a.preview.data, 1, 'FirmA→firm_intake_preview at preview_sent — should see the safe row');
    assertRows(a.uploadedFiles.data, 0, 'FirmA→uploaded_files at preview_sent — must be 0 (full_access only)');
    assertRows(a.summaries.data, 0, 'FirmA→intake_summaries at preview_sent — must be 0 (full_access only)');
    assertRows(a.timeline.data, 0, 'FirmA→timeline_events at preview_sent — must be 0 (full_access only)');

    const b = await readAllAsFirm(firmBClient, intakeA);
    assertRows(b.intakesDirect.data, 0, 'FirmB (no route)→intakes — must be 0');
    assertRows(b.preview.data, 0, 'FirmB (no route)→firm_intake_preview — must be 0');
    assertRows(b.uploadedFiles.data, 0, 'FirmB (no route)→uploaded_files — must be 0');
    assertRows(b.summaries.data, 0, 'FirmB (no route)→intake_summaries — must be 0');
    assertRows(b.timeline.data, 0, 'FirmB (no route)→timeline_events — must be 0');
  }

  // --- Regression: firm cannot self-escalate its own route ---
  console.log('\n--- REGRESSION: firm cannot set its own route to full_access directly ---');
  {
    const res = await firmAClient.from('intake_routes').update({ route_status: 'full_access' }).eq('id', routeAtoA).select('id');
    assertDenied(res, 'FirmA self-escalate route_status → full_access via direct UPDATE');
  }

  // --- Regression: firm cannot self-elevate its own firm_profiles.plan_id ---
  console.log('\n--- REGRESSION: firm cannot self-elevate plan_id on its own firm_profiles row ---');
  {
    const res = await firmAClient.from('firm_profiles').update({ plan_id: 'underwriting_high' }).eq('id', firmAId).select('id');
    assertDenied(res, 'FirmA self-elevate plan_id via direct UPDATE');
    const legit = await firmAClient.from('firm_profiles').update({ firm_name: 'RLS Test Firm A (renamed)' }).eq('id', firmAId).select('id');
    (legit.data?.length ?? 0) === 1
      ? pass('FirmA legitimate self-update (firm_name) still allowed')
      : fail(`FirmA legitimate self-update (firm_name) was blocked — over-restricted: ${legit.error?.message ?? 'no rows'}`);
  }

  // --- Escalate via the REAL production RPC, as the worker ---
  console.log('\n--- Worker A approves full access via worker_approve_full_access RPC ---');
  const approve = await workerAClient.rpc('worker_approve_full_access', { p_route_id: routeAtoA });
  if (approve.error) {
    fail(`worker_approve_full_access RPC failed: ${approve.error.message} — stage-2 assertions skipped`);
  } else {
    pass('worker_approve_full_access RPC succeeded');

    // --- Stage 2: full_access ---
    console.log('\n--- STAGE: full_access (worker approved) ---');
    const a = await readAllAsFirm(firmAClient, intakeA);
    assertRows(a.intakesDirect.data, 0, 'FirmA→intakes (direct) at full_access — STILL must be 0, no stage ever exposes worker_metadata');
    assertRows(a.preview.data, 1, 'FirmA→firm_intake_preview at full_access — still visible');
    assertRows(a.uploadedFiles.data, 1, 'FirmA→uploaded_files at full_access — now visible');
    assertRows(a.summaries.data, 1, 'FirmA→intake_summaries at full_access — now visible');
    assertRows(a.timeline.data, 1, 'FirmA→timeline_events at full_access — now visible');

    const b = await readAllAsFirm(firmBClient, intakeA);
    assertRows(b.intakesDirect.data, 0, 'FirmB (no route) at full_access→intakes — must be 0');
    assertRows(b.preview.data, 0, 'FirmB (no route) at full_access→firm_intake_preview — must be 0');
    assertRows(b.uploadedFiles.data, 0, 'FirmB (no route) at full_access→uploaded_files — must be 0 (cross-tenant)');
    assertRows(b.summaries.data, 0, 'FirmB (no route) at full_access→intake_summaries — must be 0 (cross-tenant)');
    assertRows(b.timeline.data, 0, 'FirmB (no route) at full_access→timeline_events — must be 0 (cross-tenant)');
  }
}

async function cleanup() {
  for (const id of seeded.intakeIds) {
    await admin.from('timeline_events').delete().eq('intake_id', id);
    await admin.from('intake_summaries').delete().eq('intake_id', id);
    await admin.from('uploaded_files').delete().eq('intake_id', id);
    await admin.from('intake_routes').delete().eq('intake_id', id);
    await admin.from('intakes').delete().eq('id', id);
  }
  for (const id of seeded.firmIds) {
    await admin.from('firm_profiles').delete().eq('id', id);
  }
  for (const id of seeded.userIds) {
    await admin.auth.admin.deleteUser(id).catch(() => {});
  }
}

try {
  await run();
} catch (e) {
  fail(`harness error: ${e.message}`);
} finally {
  await cleanup().catch((e) => console.error('[rls-firm-isolation] cleanup error:', e.message));
}

if (failures.length) {
  console.error(`\n[rls-firm-isolation] FAILED — ${failures.length} boundary violation(s). Firm-side isolation is broken.\n`);
  process.exit(1);
}
console.log('\n[rls-firm-isolation] PASSED — no row crossed a firm/worker boundary.\n');
process.exit(0);
