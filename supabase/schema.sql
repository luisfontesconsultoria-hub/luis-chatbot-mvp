-- V1 CRM / SDR schema
create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(), name text, phone text not null,
  company_name text, cnpj text, source text not null default 'WHATSAPP', campaign text,
  product_interest text, bank_current text, machine_current text, monthly_revenue numeric,
  pain_point text, status text not null default 'NEW', owner text default 'LUIS',
  next_action text, consent_at timestamptz, created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), unique(phone), unique(cnpj)
);
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(), lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null default 'WHATSAPP', direction text not null, external_message_id text,
  text_content text, transcript text, metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(channel, external_message_id)
);
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(), lead_id uuid references public.leads(id) on delete cascade,
  type text not null, idempotency_key text, payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), unique(idempotency_key)
);
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(), lead_id uuid references public.leads(id) on delete set null,
  action text not null, from_status text, to_status text, actor text not null default 'SYSTEM',
  metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_source_idx on public.leads(source);
create index if not exists messages_lead_created_idx on public.messages(lead_id, created_at desc);
create index if not exists events_lead_created_idx on public.events(lead_id, created_at desc);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at before update on public.leads for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists public_no_leads on public.leads;
drop policy if exists public_no_messages on public.messages;
drop policy if exists public_no_events on public.events;
drop policy if exists public_no_audit on public.audit_log;
create policy public_no_leads on public.leads for all to anon using (false) with check (false);
create policy public_no_messages on public.messages for all to anon using (false) with check (false);
create policy public_no_events on public.events for all to anon using (false) with check (false);
create policy public_no_audit on public.audit_log for all to anon using (false) with check (false);
