# one3seven — Security Hardening Roadmap: 5.1 → 9-10 (RLS/auth/migration layer — see amendment
below for what this scope does and doesn't cover)

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

**AMENDMENT 2026-08-12 (external adversarial review, applied same day as staging approval):**
this document originally overclaimed in three places, corrected here rather than silently
rewritten, matching the "don't retroactively edit history, add a note instead" principle this
doc already applies to migrations:
- **#2's "structurally impossible to reintroduce" was too strong.** The shipped check
  (`scripts/check-security-definer-current-user.mjs`) catches one textual shape: `current_user`
  inside a `SECURITY DEFINER` body, in a *tracked migration file*. It does not catch
  `current_role`, a dynamic-SQL-built check, or — the sharpest version of this gap — a function
  created directly via the dashboard instead of a migration, which is exactly how this session's
  undocumented `profiles` auto-provisioning hook got created. A catalog-level check against the
  live database (enumerate every `SECURITY DEFINER` function via `pg_proc` directly) is the
  durable answer and is now queued as **#7** below. Corrected in the script's own header comment
  too, not just here.
- **#5/#6's default live-attack target should be staging, not prod**, once staging exists. Prod
  attacks become narrowly-scoped synthetic post-deploy canaries only — not the default method.
  Tonight's prod-based verification was a justified exception (no staging existed yet), not the
  intended steady state.
- **The score table's "9-10 at steady state" is scoped to the RLS/auth/migration layer this
  roadmap actually covers** — it does not imply proven coverage of storage/signed-URL
  authorization, edge-function input validation, secrets handling, logging, dependency posture,
  or disaster recovery. Those are separately measured; folding them into one number would be a
  false precision claim. See **#8** below for the gates this roadmap was missing before any "9+"
  claim should be trusted.

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

**Shipped as `scripts/check-security-definer-current-user.mjs`** (a real Node script with
explicit match/no-match branching and a fail-closed tooling-error path, not the bash one-liner
originally sketched here — noting the discrepancy so this doc doesn't imply a shell-swallow-error
bug exists in shipped code that isn't actually there). Wired as a `lint-security-definer` job in
`ci.yml`, no staging or secrets required — it's a pure text scan, so unlike the RLS harnesses it
runs and blocks on every PR starting today, no waiting on #1.

**Outcome (revised per the amendment above):** the *known textual shape* of last night's failure
mode is caught on every PR starting today — a real, immediate improvement, but not the same as
"impossible to reintroduce" for the bug class as a whole. #7 below closes the remaining gap.

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

**Target correction (see amendment above): once staging exists, live-attack verification targets
staging by default.** A minimal, idempotent, synthetic-fixture-only canary against prod is run
post-deploy to confirm staging and prod actually agree — it is not the primary test method.
Tonight's prod-only attacks were the right call given no staging existed; they should not be the
pattern once #1 is done.

**`assertDenied`'s methodology has a real gap, also worth fixing while touching this file.**
Postgres re-checks a table's SELECT policy against a `RETURNING` clause — so on a table where the
UPDATE and SELECT policies diverge, a write could theoretically succeed while `RETURNING` reports
zero rows, and `assertDenied` would misread that as "correctly denied." Tonight's specific tests
were safe from this (both fixes raised hard `P0001` exceptions, not ambiguous zero-row responses,
and `profiles`'s SELECT policy lets an owner always read their own row regardless of what else
changed) — but the harness's general-purpose assertion shouldn't rely on that being true for every
future table. Queued: extend `assertDenied` to optionally take a privileged (service-role) reader
and a known before-value, and independently confirm the target row is unchanged, not just that
the mutating client's own response looked like a denial.

---

## #6 — Recurring drift check, not a one-time backfill (Week 3+, ongoing)

#3 fixes drift once. Left alone, it recurs — the auto-provisioning hook that caused tonight's
confusion almost certainly got created via the dashboard specifically because that felt faster
in the moment. Add a lightweight, **Docker-free** monthly (or per-release) job — tonight's own
`supabase db dump` attempt failed specifically because it shells out to a Docker-bundled
`pg_dump`, which isn't installed here, so don't propose the same tool again:

**Design correction (external review, 2026-08-12): a raw PostgREST call cannot introspect
`pg_proc`/`pg_trigger`/`information_schema` directly** — the technique tonight's live diagnosis
actually used was a purpose-built `SECURITY DEFINER` RPC (`debug_profiles_trigger_state()`) that
*wraps* a catalog query and returns rows over PostgREST; that's valid privileged access tunneled
through one RPC call, proven to work live tonight, but a one-off diagnostic RPC isn't a repeatable
drift-check design, and it's one more `SECURITY DEFINER` function to keep track of. Better shape,
adopted from the same review: a direct Postgres connection (the `pg` npm package, no Docker, no
special RPC needed) querying system catalogs from two **independently produced** sources —

```js
// scripts/schema-drift-check.mjs — uses `pg` (direct Postgres connection string, no Docker, no
// pg_dump, no special RPC) to build two catalog inventories: (1) a scratch project built purely
// by replaying supabase/migrations/*.sql, (2) prod. Diffs tables/columns/constraints/indexes,
// RLS-enabled state + policies, functions (owner, volatility, SECURITY DEFINER, search_path,
// grants), triggers, extensions/views. Non-zero exit if prod has anything the migration replay
// didn't produce.
```

This is the mechanism that keeps #3's fix from decaying back to a 3/10 over the next six months.
Run it manually the first few times; once trustworthy, it's a natural `rls-isolation`-style CI
job (though it needs the scratch-project step, so it's realistically a scheduled job, not
per-PR). Framed the way the same review suggested: **"migrations replay cleanly from an empty
project and match prod" is a better, more falsifiable security-maturity gate than a subjective
score** — and it's literally what step 2 of #1 already does the first time staging is built.

---

## #7 — Catalog-level SECURITY DEFINER audit (closes #2's remaining gap) — new, Week 2

#2's text-scan check only sees migration files. A catalog-level check, run against staging (and
usable ad hoc against prod, read-only) via the same direct-`pg`-connection technique as #6,
enumerates **every** `SECURITY DEFINER` function that actually exists in the live database —
including ones created outside migrations — and asserts, per function:
- owner is the expected role;
- `EXECUTE` is not granted to `PUBLIC` when it shouldn't be;
- `search_path` is explicitly set (an unset `search_path` on a `SECURITY DEFINER` function is a
  separate, classic Postgres privilege-escalation vector — schema-hijacking via an
  attacker-writable schema earlier in an unset search path — not one this session found evidence
  of here, but worth checking mechanically now that the tooling exists);
- the source doesn't reference `current_user`/`current_role` for what looks like a caller-identity
  decision;
- any function not clean against the above is in a small, named allowlist with a documented
  reason and a linked test — not silently ignored.

This is the piece that makes "no more of these, ever" an actual claim instead of an aspiration —
paired with #2's fast per-PR tripwire (catches the common case immediately) and this catalog audit
(catches everything else, on a schedule, once staging exists to run it against safely).

---

## #8 — Gates to clear before trusting any future "9+" claim — new, Week 2-3

Four exit criteria this roadmap didn't originally have, each more falsifiable than a subjective
score:

1. **Incident closure record** for finding #8 (the `SECURITY DEFINER` bug) specifically: exploit
   path, affected objects, first-introduced migration, remediation, regression test added,
   explicit statement of whether any real (non-test) data was exposed or modified while the bug
   was live. Cheap to write now while the details are fresh; valuable if this is ever the subject
   of a future audit or a firm's own security questionnaire.
2. **Storage/edge-function/webhook authorization sweep.** RLS on tables is not the full boundary
   if uploaded-file signed URLs, Storage bucket policies, or an edge function accepting a
   record/user/firm ID as a parameter can reach the same data by a different path. Prior sessions
   partially covered this (storage bucket policy review, several edge-function auth fixes); this
   item is "make it a standing, explicit, re-run check," not "start from zero."
3. **Production-safe canary.** After any security-relevant deploy, run a tiny, idempotent,
   synthetic-fixture-only test against prod itself (not staging) that proves deployed
   routing/auth actually matches what staging verified, then deletes its own fixtures. Separate
   from and smaller in scope than the staging-based live-attack habit in #5.
4. **Recovery proof.** Prove a clean environment can be rebuilt entirely from the repository —
   migrations, config, secrets manifest, synthetic seed data — with nothing load-bearing living
   only in someone's memory or a dashboard click history. #1's staging build is the first real
   instance of this proof; #6's scheduled drift check is what keeps it true over time.

None of these four are done yet. Don't let the score table below imply otherwise.

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
