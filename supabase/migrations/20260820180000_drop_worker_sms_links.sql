-- Removes the SMS document-upload feature (worker_sms_links + its 2 RLS policies + its index).
-- Founder call, 2026-08-20: the Twilio A2P/10DLC compliance campaign needed to send/receive SMS
-- in production has been rejected twice; rather than keep chasing approval for a feature that was
-- always scaffolding-only (see the original migration's header -- it never had real Twilio
-- credentials wired in), pull it back out until it's better understood, instead of leaving
-- non-functional infrastructure live in the schema. Removed alongside this migration: the
-- sms-inbound-webhook / sms-link-request / sms-verify-phone edge functions, smsLinkService.ts,
-- and SmsLinkCard.tsx. No other table has a foreign key into worker_sms_links and no columns on
-- intakes/profiles are SMS-specific, so this table is the entire data footprint of the feature.

drop policy if exists worker_sms_links_select_own on public.worker_sms_links;
drop policy if exists worker_sms_links_delete_own on public.worker_sms_links;
drop index if exists public.worker_sms_links_worker_id_idx;
drop table if exists public.worker_sms_links;
