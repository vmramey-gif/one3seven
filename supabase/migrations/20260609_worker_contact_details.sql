-- Worker contact details: add persistent contact columns to profiles
-- Safe migration — ADD COLUMN IF NOT EXISTS, nullable, no defaults required.
-- Apply in Supabase SQL editor or via CLI: supabase db push

alter table public.profiles
  add column if not exists middle_initial text,
  add column if not exists phone         text,
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists city          text,
  add column if not exists state         text,
  add column if not exists zip           text;

-- No new RLS policies needed — existing profiles policies cover these columns:
--   profiles_select_own  : select where id = auth.uid()
--   profiles_update_own  : update where id = auth.uid()
-- Workers can read and write only their own row.
