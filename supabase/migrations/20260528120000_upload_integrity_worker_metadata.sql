-- Upload integrity: content hash dedupe + worker checkbox/metadata persistence.
alter table public.uploaded_files
  add column if not exists content_hash text;

create unique index if not exists uploaded_files_intake_content_hash_uidx
  on public.uploaded_files (intake_id, content_hash)
  where content_hash is not null;

alter table public.intakes
  add column if not exists worker_metadata jsonb not null default '{}'::jsonb;
