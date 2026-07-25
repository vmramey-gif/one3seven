# Fix runbook — apply the security-audit fixes (2026-07-25)

Do these in order. Steps 1–4 are copy-paste into the Supabase **SQL Editor** (same place you ran the
storage policy). Step 5 is one terminal command. Check each box as you go.

Supabase project: `ebgkomrujmrkpetcdbgp`  ·  dashboard → SQL Editor.

---

## [ ] STEP 1 — See the problem (verify before)
Paste and Run. You're looking for the LOOSE policies `intake_summaries_select_firm` and
`timeline_events_select_firm` in the output. If they're there, Step 2 fixes them.

```sql
select tablename, policyname, cmd, qual
from pg_policies
where tablename in ('intake_summaries','timeline_events')
order by tablename, policyname;
```

## [ ] STEP 2 — Apply the HIGH fix (remove the loose locks)
Paste and Run. Idempotent and safe — if they were already removed, nothing happens.

```sql
drop policy if exists "intake_summaries_select_firm" on public.intake_summaries;
drop policy if exists "timeline_events_select_firm" on public.timeline_events;
```

## [ ] STEP 3 — Confirm it worked (verify after)
Run the SAME query from Step 1 again. The two loose `*_select_firm` policies should now be GONE,
and a strict `*_full_access_only` policy should remain for each table. If a full-access-only policy
is NOT present for either table, STOP and tell Claude — do not proceed to preview routing.

```sql
select tablename, policyname, cmd, qual
from pg_policies
where tablename in ('intake_summaries','timeline_events')
order by tablename, policyname;
```

## [ ] STEP 4 — Spot-check the routes table (finding #4)
Paste and Run. Confirm there is NO policy with `qual` = `true` (that would be an open door).
Expect only scoped party policies (worker-owns-intake / firm-owns-profile).

```sql
select policyname, cmd, qual, with_check
from pg_policies where tablename = 'intake_routes';
```

## [ ] STEP 5 — Redeploy the patched function (MEDIUM fix)
In a terminal, from the project folder:

```bash
npx supabase functions deploy extract-document-facts --project-ref ebgkomrujmrkpetcdbgp
```

## [ ] STEP 6 — Keep preview routing OFF (the hard rule)
`PARTICIPATING_NETWORK_LIVE` / participating-preview routing must stay OFF until Step 3 is confirmed
in production (it's already off pending counsel — leave it off). This is what makes finding #1 safe.

---

## Already done (no action)
- [x] Storage policy `intake_files_firm_full_access_read` — applied, verified rendering.
- [x] Debug line removed from the source panel.

## Not part of this fix set (separate tracks, not security)
- Stripe products / pricing tiers (see docs/stripe-setup-guide.md).
- Re-organizing existing intakes: use the "Re-organize file" button per intake (worker view).
- #3 route-insert hardening: intentionally deferred — the naive fix breaks firm-code direct access;
  needs a routing refactor first. See docs/security-audit-2026-07.md.

## When all boxes are checked
Reply to Claude "runbook done" (and paste the Step 3 output if unsure). The data layer is then sound
to put real workers' records in front of real firms.
