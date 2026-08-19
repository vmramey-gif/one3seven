-- Adds public.notifications to the supabase_realtime publication so the worker/firm bell can
-- subscribe to postgres_changes instead of only refreshing on a handful of specific actions or a
-- reload (2026-08-18 hard-challenge finding: no realtime notification delivery existed anywhere
-- in the worker-facing app). RLS (notifications_select_own, recipient_user_id = auth.uid(),
-- already enabled in 20260522120000_persistent_notifications.sql) scopes which rows a given
-- subscriber's realtime stream can see -- this migration only makes the table eligible to stream
-- changes at all. Mirrors the existing crm_messages/crm_direct_messages pattern
-- (20260629140000_crm_direct_messages.sql).
do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;
