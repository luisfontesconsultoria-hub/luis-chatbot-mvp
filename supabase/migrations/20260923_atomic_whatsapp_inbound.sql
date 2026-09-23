-- Atomic, idempotent persistence for one inbound WhatsApp message.
-- Apply only after a production backup and schema verification.
create or replace function public.crm_ingest_whatsapp_inbound(
  p_phone text, p_whatsapp_jid text, p_name text, p_source text,
  p_external_message_id text, p_text_content text,
  p_message_timestamp timestamptz, p_metadata jsonb default '{}'::jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_lead public.leads%rowtype;
  v_message public.messages%rowtype;
  v_event public.events%rowtype;
  v_existing public.messages%rowtype;
  v_phone text := nullif(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), '');
  v_jid text := nullif(lower(trim(coalesce(p_whatsapp_jid,''))), '');
begin
  if nullif(trim(coalesce(p_external_message_id,'')), '') is null then
    raise exception using errcode='22023', message='EXTERNAL_MESSAGE_ID_REQUIRED';
  end if;
  if v_phone is null and v_jid is null then
    raise exception using errcode='22023', message='WHATSAPP_IDENTITY_REQUIRED';
  end if;

  select m.* into v_existing from public.messages m
  where m.channel='WHATSAPP' and m.external_message_id=p_external_message_id limit 1;
  if found then
    select l.* into strict v_lead from public.leads l where l.id=v_existing.lead_id;
    return jsonb_build_object('duplicate',true,'lead',to_jsonb(v_lead),'message',to_jsonb(v_existing),'event',null);
  end if;

  select l.* into v_lead from public.leads l
  where (v_phone is not null and l.phone=v_phone) or (v_jid is not null and l.whatsapp_jid=v_jid)
  order by case when v_phone is not null and l.phone=v_phone then 0 else 1 end limit 1 for update;

  if not found then
    begin
      insert into public.leads(name,phone,whatsapp_jid,source,status,owner)
      values(nullif(trim(coalesce(p_name,'')),''),v_phone,v_jid,coalesce(nullif(trim(p_source),''),'WHATSAPP'),'NEW','LUIS')
      returning * into v_lead;
    exception when unique_violation then
      select l.* into strict v_lead from public.leads l
      where (v_phone is not null and l.phone=v_phone) or (v_jid is not null and l.whatsapp_jid=v_jid)
      order by case when v_phone is not null and l.phone=v_phone then 0 else 1 end limit 1 for update;
    end;
  else
    update public.leads l set phone=coalesce(l.phone,v_phone),whatsapp_jid=coalesce(l.whatsapp_jid,v_jid),name=coalesce(l.name,nullif(trim(coalesce(p_name,'')),''))
    where l.id=v_lead.id returning l.* into v_lead;
  end if;

  insert into public.events(lead_id,type,idempotency_key,payload)
  values(v_lead.id,'WHATSAPP_INBOUND',p_external_message_id,jsonb_build_object('external_message_id',p_external_message_id,'type',coalesce(p_metadata->>'type','text'),'timestamp',p_message_timestamp,'whatsapp_jid',v_jid))
  on conflict do nothing returning * into v_event;

  insert into public.messages(lead_id,channel,direction,external_message_id,text_content,metadata)
  values(v_lead.id,'WHATSAPP','INBOUND',p_external_message_id,coalesce(p_text_content,''),coalesce(p_metadata,'{}'::jsonb))
  on conflict do nothing returning * into v_message;

  if v_message.id is null then
    select m.* into strict v_message from public.messages m where m.channel='WHATSAPP' and m.external_message_id=p_external_message_id limit 1;
    return jsonb_build_object('duplicate',true,'lead',to_jsonb(v_lead),'message',to_jsonb(v_message),'event',to_jsonb(v_event));
  end if;
  return jsonb_build_object('duplicate',false,'lead',to_jsonb(v_lead),'message',to_jsonb(v_message),'event',to_jsonb(v_event));
end;
$$;

revoke all on function public.crm_ingest_whatsapp_inbound(text,text,text,text,text,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.crm_ingest_whatsapp_inbound(text,text,text,text,text,text,timestamptz,jsonb) to service_role;
