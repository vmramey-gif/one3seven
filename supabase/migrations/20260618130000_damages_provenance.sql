-- Phase 2C: per-field source provenance for the firm-facing wage-exposure estimate.
--
-- Provenance (the verbatim source snippet + any located offsets/page) lives INSIDE the
-- existing file_text_extractions.document_facts JSONB, nested per damages field, e.g.:
--   "pay_rate": {
--     "value": "$22.00/hr",
--     "source_text": "Regular rate of pay: $22.00 per hour",
--     "source_page": 1,            -- best-effort; null when not locatable
--     "source_char_start": 412,    -- best-effort; null when not locatable
--     "source_char_end": 448
--   }
-- A single per-document row holds many fields, so per-field provenance cannot be
-- represented as flat columns — it must be nested in the JSON. This migration therefore
-- adds NO per-field columns; it only records which schema version of that nested shape a
-- row carries, so older extractions (plain string values) and newer ones can coexist.
--
-- Non-breaking: the column is added with a default, so every existing row gets 0 and is
-- otherwise untouched. document_facts itself is unchanged.

alter table public.file_text_extractions
  add column if not exists damages_provenance_version integer not null default 0;

comment on column public.file_text_extractions.damages_provenance_version is
  'Schema version of per-field source provenance embedded in document_facts JSON: 0 = legacy (plain string field values, no provenance), 1 = damages fields carry { value, source_text, source_page, source_char_start, source_char_end }.';
