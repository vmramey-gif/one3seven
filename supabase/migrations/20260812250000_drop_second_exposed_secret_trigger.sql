-- Second instance of tonight's finding, caught only because the secrets-hygiene sweep was
-- deliberately widened to check EVERY trigger, not just the one already found on `profiles`.
-- `pilot_lead_email` (AFTER INSERT on public.pilot_interest, the /for-firms pilot-interest form
-- submission path) calls the same notify-pilot-lead webhook with the same hardcoded
-- service_role key and webhook secret as public_profiles (dropped in 20260812200000) — same
-- integration, wired to a second table. Same fix, same reasoning: dropped rather than patched,
-- since there's no safe way to edit a literal trigger argument in place. The pilot-lead-by-email
-- notification is now offline from BOTH entry points until rebuilt with the secret read from
-- Vault instead of a literal — see security_curriculum.md finding #9 for the full incident.
drop trigger if exists pilot_lead_email on public.pilot_interest;

-- Cleanup: drop the temporary sweep RPC now that it's done its job and found this.
drop function if exists public.sweep_all_trigger_and_function_defs();
