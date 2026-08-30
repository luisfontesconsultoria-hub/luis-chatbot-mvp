-- CRM V1: separate the commercial pipeline stage from the internal SDR state.
-- Safe rollout: add the new field, backfill it from legacy manual statuses,
-- then normalize those legacy status values so the SDR never receives an
-- unknown state from the manual CRM editor.

alter table if exists public.leads
  add column if not exists stage text not null default 'NEW';

-- Backfill the user-facing commercial stage from the legacy values that were
-- incorrectly stored in leads.status by the manual editor.
update public.leads
set stage = case upper(coalesce(status, 'NEW'))
  when 'NEW' then 'NEW'
  when 'NOVO' then 'NEW'
  when 'QUALIFYING' then 'QUALIFIED'
  when 'QUALIFIED' then 'QUALIFIED'
  when 'ACCEPTED' then 'OPPORTUNITY'
  when 'NEGOTIATION' then 'NEGOTIATION'
  when 'SCHEDULING' then 'SCHEDULING'
  when 'MEETING_MODE' then 'SCHEDULING'
  when 'CONFIRMED' then 'SCHEDULING'
  when 'AGUARDANDO_RETORNO' then 'NEGOTIATION'
  when 'AGUARDANDO_RETORNO_DO_LUIS' then 'NEGOTIATION'
  when 'HUMAN' then 'NEGOTIATION'
  when 'CONVERTIDO' then 'CONVERTED'
  when 'CLOSED' then 'CONVERTED'
  when 'PERDIDO' then 'LOST'
  when 'LOST' then 'LOST'
  else coalesce(nullif(stage, ''), 'NEW')
end
where stage is null or stage = 'NEW';

-- Legacy manual values that are not part of the canonical SDR contract are
-- moved out of status. Human/finished states are intentionally safe states:
-- they prevent the SDR from falling into its generic unknown-state fallback.
update public.leads
set status = case upper(coalesce(status, 'NEW'))
  when 'NOVO' then 'NEW'
  when 'QUALIFIED' then 'HUMAN_HANDOFF'
  when 'ACCEPTED' then 'HUMAN_HANDOFF'
  when 'NEGOTIATION' then 'HUMAN_HANDOFF'
  when 'AGUARDANDO_RETORNO' then 'AGUARDANDO_RETORNO_DO_LUIS'
  when 'HUMAN' then 'HUMAN_HANDOFF'
  when 'CONVERTIDO' then 'CLOSED'
  when 'PERDIDO' then 'LOST'
  else status
end
where upper(coalesce(status, '')) in (
  'NOVO','QUALIFIED','ACCEPTED','NEGOTIATION','AGUARDANDO_RETORNO',
  'HUMAN','CONVERTIDO','PERDIDO'
);

create index if not exists leads_stage_idx on public.leads(stage);
