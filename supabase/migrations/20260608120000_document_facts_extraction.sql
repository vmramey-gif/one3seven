-- Phase 2B: structured fact extraction column on file_text_extractions.
-- document_facts stores Claude-extracted structured JSON per document.
-- fact_extraction_status tracks whether the LLM layer has run.

alter table public.file_text_extractions
  add column if not exists document_facts jsonb,
  add column if not exists fact_extraction_status text
    default 'pending'
    check (fact_extraction_status in ('pending','processing','completed','failed','skipped')),
  add column if not exists fact_extraction_error text;

create index if not exists file_text_extractions_fact_status_idx
  on public.file_text_extractions (fact_extraction_status);

-- Firm RLS: firms with full access to an intake can read document_facts
-- (reuses the existing file_text_extractions table; no new tables needed for beta).
-- The worker RLS policies already cover select/insert/update for workers.

-- Allow firm service-role writes from the edge function (service role bypasses RLS).
-- No additional policy needed — service role key used in edge function.

comment on column public.file_text_extractions.document_facts is
  'Structured facts extracted by Claude (Phase 2B). JSON with fields: stated_reason, key_quote, complaint_topic, overtime_hours, etc.';

comment on column public.file_text_extractions.fact_extraction_status is
  'Phase 2B LLM extraction status: pending | processing | completed | failed | skipped';
