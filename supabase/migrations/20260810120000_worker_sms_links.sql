-- SMS document upload (task: text-in documents). Lets a worker text photos of pay stubs, texts,
-- etc. straight in, for workers who find that easier than the web uploader. A phone number must be
-- OTP-verified (worker proves they actually control it) before the inbound webhook will accept
-- files sent from it — otherwise anyone who learns a worker's number could try to inject files into
-- that worker's record by texting the intake line. status flips to 'verified' ONLY via the
-- sms-verify-phone edge function (service role), never by direct client update — see policies below.
--
-- SCAFFOLDING ONLY: sending/receiving SMS requires a Twilio account, which does not exist yet (the
-- founder has not signed up). Nothing here can run end-to-end until TWILIO_ACCOUNT_SID,
-- TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are set as function secrets and the inbound webhook
-- URL is configured on the Twilio number. Until then, sms-link-request returns 503.

create table if not exists public.worker_sms_links (
  id                       uuid primary key default gen_random_uuid(),
  worker_id                uuid not null references public.profiles (id) on delete cascade,
  intake_id                uuid not null references public.intakes (id) on delete cascade,
  phone_number             text not null unique,  -- E.164, e.g. +14155551234
  status                   text not null default 'pending_verification',  -- pending_verification | verified
  verification_code_hash   text,
  verification_expires_at  timestamptz,
  verified_at              timestamptz,
  created_at               timestamptz not null default now()
);

alter table public.worker_sms_links enable row level security;

create index if not exists worker_sms_links_worker_id_idx on public.worker_sms_links (worker_id);

-- Worker may see and remove their own links (e.g. to stop texting a given number in, or to
-- re-link after switching phones). No client insert/update policy exists: rows are created by
-- sms-link-request and flipped to 'verified' by sms-verify-phone, both service-role, so the
-- verification code is never generated or checked client-side.
drop policy if exists worker_sms_links_select_own on public.worker_sms_links;
create policy worker_sms_links_select_own
  on public.worker_sms_links
  for select
  to authenticated
  using (auth.uid() = worker_id);

drop policy if exists worker_sms_links_delete_own on public.worker_sms_links;
create policy worker_sms_links_delete_own
  on public.worker_sms_links
  for delete
  to authenticated
  using (auth.uid() = worker_id);
