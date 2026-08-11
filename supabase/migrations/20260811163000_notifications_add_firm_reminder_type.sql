-- Adds 'firm_reminder_added' to the notification_type whitelist, for firm_add_worker_reminder
-- (20260811160000).
--
-- Also fixes drift discovered live: the CHECK constraint in this table's original migration
-- (20260522120000) only listed 'firm_document_request' / 'worker_documents_submitted', but the
-- live database already accepts 'worker_full_access_request' and 'firm_full_access_granted' too
-- -- confirmed real production rows using both types dating back to 2026-07-17, well before
-- tonight. The constraint must have been widened directly against the database at some point
-- without a corresponding migration ever being committed. This migration is now the first one
-- that actually matches live reality, and both the table constraint and insert_notification's
-- own inline validation are updated together so they can't drift from each other again.

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check
  check (notification_type in (
    'firm_document_request', 'worker_documents_submitted',
    'worker_full_access_request', 'firm_full_access_granted',
    'firm_reminder_added'
  ));

create or replace function public.insert_notification(
  p_recipient_user_id uuid,
  p_recipient_kind text,
  p_notification_type text,
  p_title text,
  p_body text default null,
  p_payload jsonb default '{}'::jsonb,
  p_related_intake_id uuid default null,
  p_related_route_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_recipient_kind not in ('worker', 'firm') then
    raise exception 'Invalid recipient_kind' using errcode = '22023';
  end if;

  if p_notification_type not in (
    'firm_document_request', 'worker_documents_submitted',
    'worker_full_access_request', 'firm_full_access_granted',
    'firm_reminder_added'
  ) then
    raise exception 'Invalid notification_type' using errcode = '22023';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Notification title is required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from auth.users u where u.id = p_recipient_user_id
  ) then
    raise exception 'Recipient user not found' using errcode = '22023';
  end if;

  insert into public.notifications (
    recipient_user_id, recipient_kind, notification_type, title, body, payload,
    related_intake_id, related_route_id
  ) values (
    p_recipient_user_id, p_recipient_kind, p_notification_type, p_title, p_body, p_payload,
    p_related_intake_id, p_related_route_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

notify pgrst, 'reload schema';
