-- URGENT cleanup, not deferred to the usual "drop the temp RPC once done" pattern: these two
-- diagnostic RPCs (20260812180000), while granted only the same authenticated/anon EXECUTE
-- privilege as every other temporary introspection helper tonight, turned out to expose
-- something far more sensitive than the earlier ones -- pg_get_triggerdef() on `profiles`
-- returns the FULL, live `service_role` JWT hardcoded in plaintext inside the `public_profiles`
-- trigger's arguments (see security_curriculum.md for the full finding). Dropping immediately
-- rather than waiting for the baseline-migration work to finish, since every minute these stay
-- live and EXECUTE-able by anon is another minute that key is one unauthenticated RPC call away
-- from anyone who finds it.
drop function if exists public.dump_table_ddl(text[]);
drop function if exists public.dump_function_ddl(text[]);
