#!/usr/bin/env node
/**
 * RLS isolation harness — proves that one worker can NEVER read another worker's rows.
 *
 * Worker records are privileged material (Rule 1.6). A cross-user leak is a malpractice-grade
 * event, not a bug. RLS policies exist on every worker table; this test proves they still hold
 * after every change. It FAILS THE BUILD (exit 1) the moment a single row crosses a user boundary.
 *
 * HOW IT WORKS
 *   1. Service-role client creates two throwaway users (A, B).
 *   2. Service-role client seeds each an intake, then a row in every worker-owned table.
 *   3. Each user signs in and gets an RLS-subject client (anon key + their JWT).
 *   4. We assert: each user can read their OWN rows, and reads ZERO of the other user's rows.
 *   5. finally: every seeded row and both users are deleted.
 *
 * COVERAGE (worker <-> worker isolation)
 *   - intakes           ownership root:  worker_id = auth.uid()
 *   - timeline_events    child of intake: intake_id -> intakes.worker_id
 *   - intake_summaries   child of intake: intake_id -> intakes.worker_id
 *                        ALSO guards reminders + mitigation log + story follow-up + worker name,
 *                        which all live as JSON blocks inside intake_summaries.overview.
 *   - notifications      self-owned:      recipient_user_id = auth.uid()
 *   NOT here (on purpose): intake_routes + subscriptions are worker<->FIRM / billing boundaries.
 *   They belong to a firm-side attacker-matrix harness, not this worker<->worker test.
 *
 * RUNNING  — needs a NON-PRODUCTION Supabase project (staging / throwaway):
 *     SUPABASE_TEST_URL=...              # https://<ref>.supabase.co
 *     SUPABASE_TEST_ANON_KEY=...         # anon public key (the two user clients)
 *     SUPABASE_TEST_SERVICE_ROLE_KEY=... # service role (setup + teardown only)
 *   Then:  npm run test:rls
 *   No creds -> SKIPS (exit 0) so local `npm test` is never blocked; CI supplies them to enforce.
 *   Refuses the known prod ref unless RLS_TEST_ALLOW_PROD=1.
 *
 * EXTENDING — add every new worker-owned table to CHILD_TABLES (owned via an intake) or
 *   SELF_TABLES (owned via user_id). A worker table absent from these lists is an UNTESTED boundary.
 *   If a seed fails on a NOT-NULL column, the run goes red with the exact column — adjust the seed.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const URL = process.env.SUPABASE_TEST_URL?.trim();
const ANON = process.env.SUPABASE_TEST_ANON_KEY?.trim();
const SERVICE = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY?.trim();
const PROD_REF = 'ebgkomrujmrkpetcdbgp';

if (!URL || !ANON || !SERVICE) {
  console.log('\n[rls-isolation] SKIPPED — test Supabase credentials not set');
  console.log('[rls-isolation] Set SUPABASE_TEST_URL / _ANON_KEY / _SERVICE_ROLE_KEY (non-prod) to enforce.\n');
  process.exit(0);
}
if (URL.includes(PROD_REF) && process.env.RLS_TEST_ALLOW_PROD !== '1') {
  console.error('\n[rls-isolation] REFUSING to run against the production project. Use a staging/test project.\n');
  process.exit(1);
}

const admin = createClient(URL, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });

/** A user-scoped client (subject to RLS) signed in as the given credentials. */
async function userClient(email, password) {
  const c = createClient(URL, ANON, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return c;
}

/**
 * Tables owned via a parent intake (RLS gates through intake_id -> intakes.worker_id).
 * `seed(intakeId)` inserts one row (service role). `read(client, intakeId)` reads it as a user.
 */
const CHILD_TABLES = [
  {
    name: 'timeline_events',
    seed: (intakeId) => admin.from('timeline_events').insert({
      intake_id: intakeId, event_date: '2026-01-10', title: 'RLS harness event',
      category: 'Uncategorized', ai_summary: '', worker_context: '',
    }),
    read: (client, intakeId) => client.from('timeline_events').select('id').eq('intake_id', intakeId),
  },
  {
    name: 'intake_summaries', // also guards reminders / mitigation log / story follow-up / worker name (JSON in overview)
    seed: (intakeId) => admin.from('intake_summaries').insert({
      intake_id: intakeId, overview: 'RLS harness summary',
    }),
    read: (client, intakeId) => client.from('intake_summaries').select('id').eq('intake_id', intakeId),
  },
];

/**
 * Tables owned directly by the user (RLS gates via user_id = auth.uid()).
 * `seed(userId)` returns the inserted id; `list(client)` reads the user's own rows.
 */
const SELF_TABLES = [
  {
    name: 'notifications',
    seed: (userId) => admin.from('notifications')
      .insert({
        recipient_user_id: userId, recipient_kind: 'worker',
        notification_type: 'worker_documents_submitted', title: 'RLS harness', body: 'RLS harness',
      })
      .select('id').single(),
    list: (client) => client.from('notifications').select('id'),
  },
];

const failures = [];
const fail = (msg) => { failures.push(msg); console.error(`  ✗ ${msg}`); };
const pass = (msg) => console.log(`  ✓ ${msg}`);
const assertOwn = (rows, label) => ((rows?.length ?? 0) >= 1)
  ? pass(`${label}: owner reads own`)
  : fail(`${label}: owner CANNOT read own (policy too strict, or seed failed)`);
const assertIsolated = (rows, label) => ((rows?.length ?? 0) === 0)
  ? pass(`${label}: isolated`)
  : fail(`LEAK ${label}: read ${rows.length} of the other user's rows`);

const seeded = { userIds: [], intakeIds: [], notifIds: [] };

async function createUser(tag) {
  const email = `rls-test-${tag}-${randomUUID()}@one3seven-rlstest.invalid`;
  const password = `Rls!${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${tag}) failed: ${error.message}`);
  seeded.userIds.push(data.user.id);
  return { id: data.user.id, email, password };
}

async function seedIntake(workerId) {
  const insert = {
    worker_id: workerId,
    intake_number: `RLSTEST-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: 'draft',
    workflow_status: 'Upload Complete',
  };
  const { data, error } = await admin.from('intakes').insert(insert).select('id').single();
  if (error) throw new Error(`seed intake failed: ${error.message}`);
  seeded.intakeIds.push(data.id);
  return data.id;
}

async function run() {
  console.log(`\n[rls-isolation] target: ${URL}`);
  const A = await createUser('a');
  const B = await createUser('b');
  const aIntake = await seedIntake(A.id);
  const bIntake = await seedIntake(B.id);

  const aClient = await userClient(A.email, A.password);
  const bClient = await userClient(B.email, B.password);

  // --- intakes: the ownership root ---
  console.log('\nintakes — ownership root (worker_id = auth.uid())');
  {
    const own = await aClient.from('intakes').select('id').eq('id', aIntake);
    assertOwn(own.data, 'intakes A→A');
    const cross = await aClient.from('intakes').select('id').eq('id', bIntake);
    assertIsolated(cross.data, 'intakes A→B (by id)');
    const crossB = await bClient.from('intakes').select('id').eq('id', aIntake);
    assertIsolated(crossB.data, 'intakes B→A (by id)');
    const list = await aClient.from('intakes').select('id');
    (list.data ?? []).some((r) => r.id === bIntake)
      ? fail("LEAK intakes: B's intake appears in A's unfiltered list")
      : pass('intakes: A\'s unfiltered list excludes B');
  }

  // --- child-of-intake tables ---
  for (const t of CHILD_TABLES) {
    console.log(`\n${t.name} — child of intake (intake_id → intakes.worker_id)`);
    const sa = await t.seed(aIntake);
    const sb = await t.seed(bIntake);
    if (sa.error || sb.error) {
      fail(`${t.name}: seed failed — ${(sa.error || sb.error).message} (adjust seed columns in scripts/rls-isolation-test.mjs)`);
      continue;
    }
    assertOwn((await t.read(aClient, aIntake)).data, `${t.name} A→A`);
    assertIsolated((await t.read(aClient, bIntake)).data, `${t.name} A→B`);
    assertIsolated((await t.read(bClient, aIntake)).data, `${t.name} B→A`);
  }

  // --- self-owned tables (user_id = auth.uid()) ---
  for (const t of SELF_TABLES) {
    console.log(`\n${t.name} — self-owned (user_id = auth.uid())`);
    const sa = await t.seed(A.id);
    const sb = await t.seed(B.id);
    if (sa.error || sb.error) {
      fail(`${t.name}: seed failed — ${(sa.error || sb.error).message} (adjust seed columns in scripts/rls-isolation-test.mjs)`);
      continue;
    }
    if (t.name === 'notifications') { seeded.notifIds.push(sa.data.id, sb.data.id); }
    const aList = await t.list(aClient);
    const aIds = (aList.data ?? []).map((r) => r.id);
    aIds.includes(sa.data.id) ? pass(`${t.name}: A reads own`) : fail(`${t.name}: A cannot read own`);
    aIds.includes(sb.data.id) ? fail(`LEAK ${t.name}: B's row appears for A`) : pass(`${t.name}: A excludes B's row`);
    const bList = await t.list(bClient);
    const bIds = (bList.data ?? []).map((r) => r.id);
    bIds.includes(sa.data.id) ? fail(`LEAK ${t.name}: A's row appears for B`) : pass(`${t.name}: B excludes A's row`);
  }
}

async function cleanup() {
  for (const id of seeded.notifIds) {
    await admin.from('notifications').delete().eq('id', id);
  }
  for (const id of seeded.intakeIds) {
    await admin.from('timeline_events').delete().eq('intake_id', id);
    await admin.from('intake_summaries').delete().eq('intake_id', id);
    await admin.from('intakes').delete().eq('id', id);
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
  await cleanup().catch((e) => console.error('[rls-isolation] cleanup error:', e.message));
}

if (failures.length) {
  console.error(`\n[rls-isolation] FAILED — ${failures.length} boundary violation(s). Worker isolation is broken.\n`);
  process.exit(1);
}
console.log('\n[rls-isolation] PASSED — no row crossed a user boundary.\n');
process.exit(0);
