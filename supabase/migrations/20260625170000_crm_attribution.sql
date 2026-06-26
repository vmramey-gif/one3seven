-- Rep attribution: capture WHO logged each activity and WHO first contacted each firm,
-- so credit is per-rep and contacted firms can drop off the shared "to contact" list.

-- Who logged the activity.
alter table public.crm_activity add column if not exists logged_by uuid references auth.users(id);
alter table public.crm_activity add column if not exists logged_by_name text;

-- Who first contacted the firm (claim model — first logged activity owns it), and when.
alter table public.crm_firms add column if not exists contacted_by uuid references auth.users(id);
alter table public.crm_firms add column if not exists contacted_by_name text;
alter table public.crm_firms add column if not exists contacted_at timestamptz;

notify pgrst, 'reload schema';
