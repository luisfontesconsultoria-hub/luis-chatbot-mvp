-- CRM production persistence permissions.
-- Run this once in the Supabase SQL Editor for the production project.
-- The backend uses the service_role credential; RLS remains enabled for client-facing access.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.leads
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.messages
TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLE public.events
TO service_role;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA public
TO service_role;
