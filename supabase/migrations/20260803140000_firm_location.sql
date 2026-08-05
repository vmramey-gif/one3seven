-- Firm location for the CRM map view. city/address are entered; latitude/longitude are the
-- geocode CACHE (filled once when a city is set, so we don't re-geocode on every load).
alter table public.crm_firms add column if not exists city       text;
alter table public.crm_firms add column if not exists address    text;
alter table public.crm_firms add column if not exists latitude   double precision;
alter table public.crm_firms add column if not exists longitude  double precision;
