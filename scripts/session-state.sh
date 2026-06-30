#!/usr/bin/env bash
# one3seven — session state snapshot. Run at the start of a build session and paste
# the output into chat so the assistant is grounded in reality, not stale memory.
#   npm run state     (or)   bash scripts/session-state.sh
set +e
strip() { sed 's/\x1b\[[0-9;]*m//g'; }

echo "===== one3seven · session state · $(date '+%Y-%m-%d %H:%M') ====="
echo
echo "── Branch / dirty files ──"
git rev-parse --abbrev-ref HEAD
git status --short | head -20
echo
echo "── Last 10 commits ──"
git log --oneline -10
echo
echo "── Tests (vitest) ──"
npx vitest run 2>&1 | strip | tail -4
echo
echo "── tsc errors (pre-existing debt; Vite build is NOT tsc-gated) ──"
TSC="$(npx tsc --noEmit 2>&1)"
echo "Total: $(echo "$TSC" | grep -c 'error TS')"
echo "$TSC" | grep -oE '^[^(]+\.tsx?' | sort | uniq -c | sort -rn | head -10
echo
echo "── Pending operator SQL (unapplied seeds/migrations are NOT auto-run) ──"
ls -1 supabase/seed/*.sql supabase/migrations/*.sql 2>/dev/null | tail -8
echo
echo "(main auto-deploys to Vercel; SQL in supabase/ is operator-run in the dashboard)"
