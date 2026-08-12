-- Found while verifying the trigger removal above: this Supabase project grants EXECUTE on new
-- `public` schema functions to anon/authenticated directly (independent of the PUBLIC pseudo-
-- role), most likely via an ALTER DEFAULT PRIVILEGES bootstrap set up when the project was
-- created -- confirmed live: `revoke execute ... from public` alone did NOT block an anon call
-- to a freshly created function. That means the earlier catalog audit's
-- execute_granted_to_public column (which only checked the PUBLIC grantee via aclexplode) UNDER-
-- reported real exposure for any function relying on an implicit/default grant rather than an
-- explicit `grant ... to public`. Re-checked every function the audit had marked
-- execute_granted_to_public = false by hand against their own source: all but one
-- (insert_notification) have their own auth.uid()-based caller-identity check and are safe
-- regardless of the wider-than-expected grant. insert_notification has none -- it was designed
-- as an internal helper for other SECURITY DEFINER functions to call (worker_approve_full_access,
-- firm_add_worker_reminder, etc., all of which do their own authorization before calling it),
-- not for direct client use. Live-confirmed exploitable: an anonymous REST call reached its
-- internal validation logic (a function-level error, not a permission-denied), meaning any
-- unauthenticated caller could insert an arbitrary notification for any real user.
--
-- Fix: explicit REVOKE from anon AND authenticated (not just PUBLIC, given what was just
-- learned). Internal callers are unaffected -- they invoke it via `perform
-- public.insert_notification(...)` from within their own SECURITY DEFINER execution context
-- (owned by the same role), which does not depend on grants to anon/authenticated at all.
revoke execute on function public.insert_notification(
  uuid, text, text, text, text, jsonb, uuid, uuid
) from anon, authenticated;

-- Cleanup: drop the temporary, locked-down verification function from the previous migration.
drop function if exists public.verify_public_profiles_trigger_gone();
