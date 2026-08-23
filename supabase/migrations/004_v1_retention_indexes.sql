-- Lightweight operational indexes for retention and cleanup jobs.
-- Data deletion itself remains an explicit operational job; this migration only
-- prepares the database so cleanup can use indexed timestamps.
create index if not exists messages_retention_idx on public.messages(created_at);
create index if not exists events_retention_idx on public.events(created_at);
create index if not exists audit_log_retention_idx on public.audit_log(created_at);
