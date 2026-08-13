-- Two real gaps found by a live-code audit of the CRM subsystem (2026-08-13), both closed here:
--
-- 1. crm_firms/crm_activity RLS granted "for all" to any CRM member with no ownership check.
--    Concretely: any invited rep could reassign or delete another rep's claimed firm, or
--    rewrite/delete another rep's activity log, via a direct Supabase client call -- bypassing
--    the app's atomic claim check (claimFirm) and the "founder-only" comment on assignFirm
--    entirely, since neither was ever enforced at the database layer.
--
-- 2. Revoking a rep's CRM access had no working path at all, not even for the founder.
--    20260727120000 correctly revoked UPDATE on profiles.is_founder/crm_role/approved/role from
--    `authenticated` to close a self-escalation hole -- but that also removed the founder's own
--    ability to clear a rep's crm_role through the app, since RLS also restricts profiles UPDATE
--    to auth.uid() = id (a founder can't UPDATE another user's row regardless of column grants).
--    No SECURITY DEFINER "revoke" function existed to fill the gap.

-- ── 1. Ownership-scoped crm_firms / crm_activity policies ─────────────────────────────────────
-- Replaces the single "for all" policy with one policy per command so read (shared pipeline
-- visibility, unchanged) and write (now ownership-aware) can differ.

drop policy if exists "crm_firms_member_all" on public.crm_firms;

create policy "crm_firms_select_members" on public.crm_firms
  for select to authenticated using (public.is_crm_member());

create policy "crm_firms_insert_members" on public.crm_firms
  for insert to authenticated with check (public.is_crm_member());

-- A rep may update a firm only while it's unclaimed or claimed by them -- matches exactly what
-- claimFirm()'s atomic `.is('contacted_by', null)` check and assignFirm()'s "founder-only" reassign
-- comment already assumed, now actually enforced. Founder bypasses both sides unconditionally.
create policy "crm_firms_update_owner_or_founder" on public.crm_firms
  for update to authenticated
  using (public.is_crm_member() and (public.is_founder() or contacted_by is null or contacted_by = auth.uid()))
  with check (public.is_founder() or contacted_by is null or contacted_by = auth.uid());

-- The app never deletes a crm_firms row (grepped: no .delete() call anywhere) -- founder-only is
-- a pure safety tightening with zero behavior change for the real product.
create policy "crm_firms_delete_founder" on public.crm_firms
  for delete to authenticated using (public.is_founder());

drop policy if exists "crm_activity_member_all" on public.crm_activity;

create policy "crm_activity_select_members" on public.crm_activity
  for select to authenticated using (public.is_crm_member());

-- logCall()/etc always set logged_by = the caller's own id -- requiring it here just stops a rep
-- from being able to log activity misattributed to someone else.
create policy "crm_activity_insert_own" on public.crm_activity
  for insert to authenticated with check (public.is_crm_member() and logged_by = auth.uid());

-- The app never updates or deletes a crm_activity row either -- same pattern already used for
-- crm_notes (author or founder only), applied here for the same reason.
create policy "crm_activity_update_own_or_founder" on public.crm_activity
  for update to authenticated
  using (public.is_crm_member() and (logged_by = auth.uid() or public.is_founder()))
  with check (logged_by = auth.uid() or public.is_founder());

create policy "crm_activity_delete_own_or_founder" on public.crm_activity
  for delete to authenticated using (public.is_crm_member() and (logged_by = auth.uid() or public.is_founder()));

-- ── 2. A working revoke path ───────────────────────────────────────────────────────────────────
-- SECURITY DEFINER so it can clear crm_role despite the column-level REVOKE from `authenticated`
-- (20260727120000) -- that REVOKE correctly stops a client-side .update() from touching the
-- column at all; this function runs as its owner, not as the calling role, so it isn't subject to
-- that grant. The caller-is-founder check is what keeps this safe, not the column grant.
create or replace function public.revoke_crm_rep_access(target_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target_email text;
begin
  if not public.is_founder() then
    raise exception 'Only the founder can revoke CRM rep access.';
  end if;

  update public.profiles set crm_role = null
    where id = target_user_id and crm_role = 'rep';

  select email into target_email from auth.users where id = target_user_id;
  if target_email is not null then
    update public.crm_invites set status = 'revoked'
      where lower(email) = lower(target_email) and status <> 'revoked';
  end if;
end;
$$;
grant execute on function public.revoke_crm_rep_access(uuid) to authenticated;

notify pgrst, 'reload schema';
