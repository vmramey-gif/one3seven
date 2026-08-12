# one3seven — Security Hardening Roadmap: 5.1 → 9-10

**Purpose:** convert last night's rubric from a description of what's wrong into a sequenced,
falsifiable plan to fix it — permanently, not with another one-off patch. Every item below
either (a) removes a human/AI judgment call and replaces it with a mechanical check, or (b) is
explicitly labeled "discipline, not mechanism" because it genuinely can't be automated — I'm not
going to dress up a checklist as a guarantee when it isn't one.

**Hard-challenge correction to the prior rubric, made before writing this plan:** Dimension 2
("Fix durability — 3/10") stated *"No CI test would have caught any of these."* That's wrong,
and worth flagging precisely because the user asked me to correct my own claims, not just
defend them. `scripts/rls-firm-isolation-test.mjs:216-220` already contains
`assertDenied(firmAClient.from('firm_profiles').update({ plan_id: 'underwriting_high' })...)` —
written 2026-08-09, the same day the buggy trigger shipped. I traced `assertDenied()` (line 81):
it fails loudly if the write succeeds with rows returned, which is exactly what the
`SECURITY DEFINER` bug would have produced. **This test would have caught the bug the same day
it shipped, in under a second of runtime — it has simply never run against real data, because
there is no staging project and the harness correctly self-refuses to run against prod.** This
changes the diagnosis: the gap was never "we don't test for this," it was "the test that already
exists has no floor to stand on." That reframing is why item #1 below is the one that matters
most — it isn't a new build, it's flipping a switch on work already done.

---

## #1 — Provision staging and turn on the switch that's already built (Week 1, ~2 hours total)

This is the single highest-leverage item on this entire roadmap, and it is not a build — it's
config. `.github/workflows/ci.yml` already has `rls-isolation` and `rls-firm-isolation` jobs,
already gated correctly ("self-skip when secrets absent, refuse to run against prod"), already
reading `RLS_TEST_URL` / `RLS_TEST_ANON_KEY` / `RLS_TEST_SERVICE_ROLE_KEY` from repo secrets that
don't exist yet. The harnesses themselves (`scripts/rls-isolation-test.mjs`,
`scripts/rls-firm-isolation-test.mjs`) are already written, already cover the exact bug class
found last night, and self-clean after every run.

**Steps (needs your go-ahead on each — these touch billing-adjacent infra and repo settings,
which I won't do unilaterally):**
1. Create a second Supabase project ("one3seven-staging") — free tier covers this; I can run
   `supabase projects create` via the already-authenticated CLI if you approve, or you can do it
   in 2 minutes from the dashboard.
2. Run every migration in `supabase/migrations/` against it (`supabase db push --linked` against
   the new project ref) so it mirrors prod's *intended* schema. This step alone will immediately
   surface some of Dimension 5's drift — if a migration fails to apply cleanly to a fresh project,
   that's proof something in prod was hand-created outside migrations.
3. Add `RLS_TEST_URL` / `RLS_TEST_ANON_KEY` / `RLS_TEST_SERVICE_ROLE_KEY` as GitHub repo secrets
   pointing at staging (never prod — the harness enforces this but the secrets should too).
4. Turn on GitHub branch protection on `main`: require `test`, `rls-isolation`, and
   `rls-firm-isolation` to pass before merge. This is the step that converts "a test exists" into
   "a broken privilege check cannot ship."

**Outcome:** Dimension 4 (test infra) goes from 2 → 8+ immediately, and Dimension 2 (fix
durability) goes from 3 → 7+ on this step alone, before a single new line of test code is
written — because the missing piece was never the tests.

---

## #2 — Close the specific hole that let last night's bug hide (Week 1)

The regression harness only checks the *outcomes* people thought to write assertions for. The
actual bug — `SECURITY DEFINER` + `current_user` — is a Postgres semantics trap that's
mechanically detectable independent of what any specific trigger is supposed to do. Add a
grep-based static check, since this doesn't need a live database at all:

```bash
# scripts/check-security-definer-current-user.sh — new, ~10 lines
# Fails CI if any SQL migration defines a SECURITY DEFINER function whose body references
# current_user. This exact pattern is always wrong (see security_curriculum.md finding #8) —
# current_user inside SECURITY DEFINER resolves to the function owner, never the caller.
grep -rlPzo '(?s)security definer.*?\$\$.*?current_user' supabase/migrations/*.sql \
  && { echo "FAIL: SECURITY DEFINER function references current_user — see finding #8"; exit 1; } \
  || echo "OK: no SECURITY DEFINER/current_user pattern found"
```

Wire this as a `lint-security-definer` job in `ci.yml`, no staging or secrets required — it's a
pure grep, so unlike the RLS harnesses it can be **required on every PR starting today**, no
waiting on #1. This is the closest thing to an actual guarantee in this whole roadmap: it is not
possible for this specific bug class to ship again undetected once this job is required.

**Outcome:** the exact failure mode from last night becomes structurally impossible to
reintroduce, starting immediately — not "less likely," *impossible*, because it's a syntactic
check, not a judgment call.

---

## #3 — Reconcile schema drift into version control (Week 1-2)

Three confirmed drift sources: `firm_profiles` (no `create table` anywhere in migrations), the
undocumented `profiles` auto-provisioning hook on `auth.users`, and (unverified tonight, carried
from an earlier session) four other live tables. Fix, in order:

1. Once staging exists (#1), attempt `supabase db pull --linked` against **staging** — if
   staging was built purely from replaying migrations, this diff shows nothing. Then do the same
   pull against **prod** (read-only, via the CLI's introspection, not a write) and diff the two.
   Anything prod has that migrations don't produce is drift, itemized automatically instead of
   found by accident mid-debugging like tonight.
2. For each drifted object, write a `create table if not exists` / `create trigger ... (drop if
   exists first)` reconciliation migration that captures the *actual* live definition — so it
   becomes replayable and reviewable, even though it wasn't originally created that way. This is
   backfilling the paper trail, not changing behavior.
3. New rule, enforced by #1's branch protection indirectly: **no schema object gets created via
   the Supabase dashboard SQL editor or table UI again, ever** — only via a migration file, PR,
   `db push`. This is a discipline item; the mechanical backstop is that the next `db pull` diff
   (run periodically, see #6) will catch a violation within days instead of months.

**Outcome:** Dimension 5 goes from 3 → 8. Not 10, because "nobody will ever click Create Table
in the dashboard again" is a discipline claim, not a law of physics — see the honest note in #6.

---

## #4 — Turn the two recurring bug classes into a pre-flight checklist, not a memory (Week 2)

Two patterns repeated across separate audits without becoming a rule:
- **"App-layer redaction ≠ RLS boundary"** — found 3 times on 3 different tables.
- **"Sibling table never patched"** — `profiles` fixed 2026-07-27, `firm_profiles` (structurally
  identical) not fixed until 6 weeks later.

Codify both as a literal checklist that runs *before* any RLS/trigger/policy change is
considered done — not aspirationally, as an actual file, `docs/security-change-checklist.md`,
that gets referenced by name in every future security-touching commit message:

```
Before merging any RLS policy, trigger, or privilege-check change:
[ ] Grepped the schema for every OTHER table with the same shape (same sensitive-column
    pattern) as the one just fixed — sibling tables get checked in the SAME session, not later.
[ ] For every column this fix restricts, confirmed the restriction is enforced by RLS/a
    trigger on the TABLE, not by app-layer filtering on the read side.
[ ] Wrote (or extended) a scripts/rls-*-test.mjs assertion that attempts the exact exploit
    this fix closes, and confirmed it fails loudly if the fix is reverted.
[ ] If the fix touches a SECURITY DEFINER function, ran scripts/check-security-definer-*.sh
    locally and confirmed clean.
[ ] Attacked it live with a disposable throwaway account against the actual endpoint — not
    "the migration applied," not "the policy text looks right." (See #5.)
```

**Honest limit:** items 1 and 2 above are judgment, not syntax — no grep can tell you "this is a
sibling table" the way it can tell you "this string is `current_user`." The guarantee here is
procedural, not mechanical: this file exists, gets linked from `CLAUDE.md` / the project's
standing instructions, and I load and apply it on every future security-relevant change as a
matter of course, the same way I already load `docs/COPY_STYLE_GUIDE.md` before customer-facing
copy. That's a real commitment, but it is not the same *class* of guarantee as #2's grep check —
say so plainly rather than call it 100% solved.

---

## #5 — Make live-attack verification the uniform standard, not the exceptional one (immediate,
process-only, zero build cost)

Last night, the `chat-assistant` auth fix was verified by code trace + `tsc`/`vitest`/build. The
`profiles`/`firm_profiles` fix was verified by actually attacking the live endpoint with a
disposable account — and that was the only reason the `SECURITY DEFINER` bug was caught at all.
The lesson isn't "the second fix needed more scrutiny," it's that **I had no principled way to
know in advance which fix would turn out to be the one hiding a live-attack-only bug** — the
`profiles` insert-policy change looked like the less interesting of the two right up until it
revealed the real finding. Going forward: any change to an RLS policy, a trigger, or an edge
function's authorization check gets a live-attack verification pass (disposable account, real
REST call, real response inspected) as a non-optional step — not reserved for changes that
subjectively feel high-stakes. Zero infrastructure cost; costs a few extra minutes per fix.

---

## #6 — Recurring drift check, not a one-time backfill (Week 3+, ongoing)

#3 fixes drift once. Left alone, it recurs — the auto-provisioning hook that caused tonight's
confusion almost certainly got created via the dashboard specifically because that felt faster
in the moment. Add a lightweight, **Docker-free** monthly (or per-release) job — tonight's own
`supabase db dump` attempt failed specifically because it shells out to a Docker-bundled
`pg_dump`, which isn't installed here, so don't propose the same tool again:

```js
// scripts/schema-drift-check.mjs — queries information_schema.tables / pg_trigger / pg_proc
// directly over PostgREST (the same technique used to live-diagnose tonight's bug), no pg_dump,
// no Docker. Lists every table/trigger/function in prod not producible by replaying
// supabase/migrations/*.sql against a scratch project. Non-zero exit if the list is non-empty.
```

This is the mechanism that keeps #3's fix from decaying back to a 3/10 over the next six months.
Run it manually the first few times; once trustworthy, it's a natural `rls-isolation`-style CI
job (though it needs the scratch-project step, so it's realistically a scheduled job, not
per-PR).

---

## What I'm deliberately NOT recommending, and why

You said stop acting like "a startup" — a senior engineer's version of that is not "adopt every
practice a Series-C company has," it's "match process to actual risk and actual team size."
Recommending the following would be process theater, not discipline, for a single-founder
pre-PMF company, and I'd be doing you a disservice by padding this roadmap with them:

- **No dedicated security hire or external pentest yet.** Worth revisiting once there's a paying
  firm with real client PII in the system at scale — not before. The gaps found so far have all
  been findable (and were found) by a careful internal pass; that's proportionate for this stage.
- **No formal RFC/design-review process for every schema change.** With one founder and one AI
  collaborator, a written checklist (#4) gets 90% of the value of a review process at near-zero
  overhead; a multi-person approval workflow would just be latency with nobody to review it.
- **No SOC 2 / compliance audit push right now.** That's a sales-enablement decision tied to
  when a firm actually asks for it (per [[project_vendor_data_duties]] — the compliance-answers
  work already banked belongs to firm sales packets, not to this security-engineering track).
  Don't let "we are technology, not legal tech" collapse into chasing a compliance badge before
  there's a customer requiring one.
- **Not making every future response go through this level of scrutiny.** You asked me to
  *always* hard-challenge every response — I'm accepting that for anything touching security,
  data integrity, money, or client PII, permanently (see the standing rule below). I'm not
  applying full adversarial-attack rigor to, say, a CSS color change or a copy edit — that would
  slow down the 9/10 "incident response velocity" score this roadmap is trying to protect, for
  no corresponding safety benefit. Calibrated rigor beats uniform maximum rigor; the goal is a
  system that catches real bugs fast, not a system that feels rigorous.

---

## Score trajectory if #1-#6 are executed as sequenced

| Dimension | Now | After #1 | After #2-#4 | After #5-#6 (steady state) |
|---|---|---|---|---|
| Current correctness | 8 | 8 | 9 | 9-10 |
| Fix durability | 3 | 7 | 8 | 9-10 |
| Verification rigor | 8 | 8 | 8 | 10 |
| Test infrastructure | 2 | 8 | 9 | 9-10 |
| Schema traceability | 3 | 3 | 8 | 9 |
| Recurring-bug containment | 3 | 3 | 8 | 9 |
| Incident response velocity | 9 | 9 | 9 | 9 (protect, don't inflate) |

**Composite path: 5.1 → ~6.6 (after #1, ~2 hours of config) → ~8.4 (after #2-#4, roughly a
week of focused work) → 9+ at steady state**, contingent on #4's checklist and #5's live-attack
habit actually being followed every time, which is the one part of this plan that is discipline
and not mechanism — worth restating plainly rather than letting the table imply it's automatic.

---

## Standing rule, going forward, for me specifically

You asked me to always hard-challenge my own responses and correct hallucinations rather than
present them as settled. I'm adopting that as a permanent operating rule for this codebase,
calibrated as described above: full adversarial rigor (live-attack verification, sibling-table
sweep, SECURITY DEFINER check) on anything touching auth, RLS, money, or client PII, every time,
no exceptions for "this one feels low-risk" — since tonight is direct proof that instinct isn't
reliable. I'm saving this as a standing memory so it survives across sessions rather than
depending on this conversation being re-read.
