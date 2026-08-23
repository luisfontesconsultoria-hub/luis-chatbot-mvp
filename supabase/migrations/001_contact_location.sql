-- Add manual-contact and geolocation fields to the CRM.
alter table public.leads add column if not exists address text;
alter table public.leads add column if not exists city text;
alter table public.leads add column if not exists state text;
alter table public.leads add column if not exists zip_code text;
alter table public.leads add column if not exists latitude double precision;
alter table public.leads add column if not exists longitude double precision;
alter table public.leads add column if not exists location_source text;

create index if not exists leads_city_state_idx on public.leads(city,state);
