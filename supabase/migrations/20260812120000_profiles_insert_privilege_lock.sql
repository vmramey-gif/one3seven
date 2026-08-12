-- P0 privilege-escalation fix (independent adversarial security review, 2026-08-12) —
-- APPLY BEFORE ONBOARDING ANY REAL FIRM.
--
-- Root cause: 20260727120000_fix_profiles_privilege_escalation.sql locked is_founder /
-- crm_role / approved / role against being changed via UPDATE, but the trigger it added is
-- `before update` only. There is no server-side trigger on auth.users that creates a
-- profiles row automatically (confirmed: no such trigger exists in any migration) — the
-- client's own ensureUserProfile() does the first INSERT. The existing "profiles_insert_own"
-- policy (20260515180000) is `with check (auth.uid() = id)` with no column restriction at
-- all. Combined, a freshly-signed-up user can POST directly to /rest/v1/profiles (using
-- their own real access token — no exploit needed beyond calling the API instead of the app)
-- with a row like { id: <own uid>, is_founder: true } and it is accepted outright: the INSERT
-- happens before any row exists, so the UPDATE-only trigger never runs. That grants the
-- caller founder-gated access to every CRM table (crm_firms, crm_activity, crm_messages,
-- crm_notes, demo_debriefs, web_events, pilot_interest PII) via public.is_founder(). The same
-- gap lets a worker insert role: 'firm' to bypass the (client-UI-only) invite gate in
-- RoleSelectionScreen, or crm_role: 'rep' / approved: true directly.
--
-- Fix: extend the privilege-lock trigger to also fire BEFORE INSERT. On insert, force
-- is_founder/crm_role/approved to safe defaults for any caller that isn't service_role,
-- regardless of what the client sends. `role` is left alone on insert (worker/firm self-
-- selection at signup is a legitimate, existing product flow gated — imperfectly, but
-- separately — by RoleSelectionScreen's invite check; it carries no founder/CRM access by
-- itself). Belt-and-suspenders: also revoke column-level INSERT on the same three columns.

create or replace function public.enforce_profile_privilege_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role (edge functions / admin) and superuser bypass the lock: legitimate
  -- founder onboarding, rep invites, and approval flows run with elevated privilege.
  if current_user in ('service_role', 'supabase_admin', 'postgres') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A brand-new row can never self-grant founder/rep/approved status — those are always
    -- granted afterward by an existing founder or an approval edge function, never at signup.
    new.is_founder := false;
    new.crm_role := null;
    new.approved := false;
    return new;
  end if;

  -- UPDATE path (unchanged from 20260727120000): an existing founder may change these
  -- columns (grant/revoke rep access, approve users).
  if coalesce(old.is_founder, false) = true then
    return new;
  end if;

  -- Otherwise the row owner may NOT change any privilege column.
  if new.is_founder is distinct from old.is_founder
     or new.crm_role is distinct from old.crm_role
     or new.approved is distinct from old.approved
     or new.role is distinct from old.role then
    raise exception
      'profiles: privilege columns (is_founder, crm_role, approved, role) cannot be changed by the row owner';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_privilege_lock on public.profiles;
create trigger trg_profiles_privilege_lock
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_privilege_lock();

-- Belt-and-suspenders: authenticated users cannot write these columns at all, on insert or
-- update, so even a policy/trigger regression cannot re-open the escalation.
revoke insert (is_founder, crm_role, approved) on public.profiles from authenticated;
