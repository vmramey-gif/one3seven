-- Cleanup: drop the confirmation sweep RPC now that it has proven zero secrets remain (see
-- 20260812260000). No live diagnostic RPCs should be left installed once their job is done.
drop function if exists public.sweep_all_trigger_and_function_defs();
