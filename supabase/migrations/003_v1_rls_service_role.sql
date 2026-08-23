-- V1 production RLS hardening.
-- The backend uses the Supabase service-role key and therefore bypasses RLS.
-- No public/anon policies are created for CRM data.

alter table public.leads enable row level security;
alter table public.messages enable row level security;
alter table public.events enable row level security;
alter table public.audit_log enable row level security;

revoke all on table public.leads from anon, authenticated;
revoke all on table public.messages from anon, authenticated;
revoke all on table public.events from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;
