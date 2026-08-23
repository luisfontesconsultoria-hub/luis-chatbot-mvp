-- Canonical V1 schema for the production backend.
-- Legacy Portuguese tables, if present, are intentionally left untouched until
-- the canonical schema is verified in production.

create extension if not exists pgcrypto;

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  company_name text,
  phone text not null,
  cnpj text,
  source text default 'WHATSAPP',
  campaign text,
  product_interest text,
  bank_current text,
  machine_current text,
  monthly_revenue numeric,
  pain_point text,
  status text default 'NOVO',
  owner text,
  next_action text,
  consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists leads_phone_unique on public.leads(phone);
create index if not exists leads_status_idx on public.leads(status);
create index if not exists leads_cnpj_idx on public.leads(cnpj);
create index if not exists leads_created_at_idx on public.leads(created_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null default 'WHATSAPP',
  direction text not null default 'INBOUND',
  external_message_id text,
  text_content text,
  transcript text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists messages_lead_id_idx on public.messages(lead_id);
create index if not exists messages_created_at_idx on public.messages(created_at desc);
create unique index if not exists messages_external_id_unique on public.messages(external_message_id) where external_message_id is not null;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  type text not null,
  idempotency_key text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists events_idempotency_unique on public.events(idempotency_key) where idempotency_key is not null;
create index if not exists events_lead_id_idx on public.events(lead_id);
create index if not exists events_created_at_idx on public.events(created_at desc);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  action text not null,
  from_status text,
  to_status text,
  actor text default 'SYSTEM',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_lead_id_idx on public.audit_log(lead_id);
create index if not exists audit_log_created_at_idx on public.audit_log(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;
alter table public.audit_log enable row level security;
