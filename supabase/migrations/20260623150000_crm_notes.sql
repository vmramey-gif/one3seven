-- Shared team notes board for the CRM: founder + invited reps post and read shared notes.
-- Read/insert limited to CRM members; a note can be deleted by its author or the founder.

create table if not exists public.crm_notes (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.crm_notes enable row level security;

drop policy if exists "crm_notes_member_read" on public.crm_notes;
create policy "crm_notes_member_read" on public.crm_notes
  for select to authenticated using (public.is_crm_member());

drop policy if exists "crm_notes_member_insert" on public.crm_notes;
create policy "crm_notes_member_insert" on public.crm_notes
  for insert to authenticated with check (public.is_crm_member() and author_id = auth.uid());

drop policy if exists "crm_notes_delete_own_or_founder" on public.crm_notes;
create policy "crm_notes_delete_own_or_founder" on public.crm_notes
  for delete to authenticated using (public.is_crm_member() and (author_id = auth.uid() or public.is_founder()));

create index if not exists crm_notes_created_idx on public.crm_notes(created_at);

notify pgrst, 'reload schema';
