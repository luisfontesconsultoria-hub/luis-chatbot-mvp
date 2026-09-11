-- Allow WhatsApp/Baileys LID-only contacts to exist before a phone number is resolved.
-- Existing phone-based leads remain unchanged.
alter table public.leads add column if not exists whatsapp_jid text;
alter table public.leads alter column phone drop not null;
create unique index if not exists leads_whatsapp_jid_uidx
  on public.leads (whatsapp_jid)
  where whatsapp_jid is not null;
