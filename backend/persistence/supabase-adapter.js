/** Server-side Supabase adapter. Existing V1 tables remain the source of truth. */
const { TABLES, assertRepository } = require('./supabase-contract');
const { toDbLead, fromDbLead } = require('./crm-mapper');
function createSupabaseRepository(client) {
  if (!client || typeof client.from !== 'function') throw new Error('SUPABASE_CLIENT_REQUIRED');
  return assertRepository({
    async listLeads({limit=50,source,status}={}){let q=client.from(TABLES.leads).select('*').limit(limit);if(source)q=q.eq('source',source);if(status)q=q.eq('status',status);const{data,error}=await q;if(error)throw error;return(data||[]).map(fromDbLead)},
    async getLead(id){const{data,error}=await client.from(TABLES.leads).select('*').eq('id',id).single();if(error&&error.code!=='PGRST116')throw error;return data?fromDbLead(data):null},
    async findOrCreateLeadByPhone(phone,defaults={}){if(!phone)throw new Error('PHONE_REQUIRED');const normalized=String(phone).replace(/\D/g,'');const{data:existing,error}=await client.from(TABLES.leads).select('*').eq('phone',normalized).limit(1);if(error)throw error;if(existing&&existing[0])return fromDbLead(existing[0]);return this.createLead({phone:normalized,source:defaults.source||'WHATSAPP'})},
    async createLead(payload){const{data,error}=await client.from(TABLES.leads).insert(toDbLead(payload)).select('*').single();if(error)throw error;return fromDbLead(data)},
    async updateLead(id,patch){const{data,error}=await client.from(TABLES.leads).update(toDbLead(patch)).eq('id',id).select('*').single();if(error)throw error;return fromDbLead(data)},
    async createMessage(payload){const row={lead_id:payload.lead_id,channel:payload.channel||'WHATSAPP',direction:payload.direction||'INBOUND',external_message_id:payload.external_message_id||null,text_content:payload.text_content!==undefined?payload.text_content:(payload.text||''),transcript:payload.transcript||null,metadata:payload.metadata||{}};const{data,error}=await client.from(TABLES.messages).insert(row).select('*').single();if(error)throw error;return data},
    async listMessages({leadId,limit=100}={}){const{data,error}=await client.from(TABLES.messages).select('*').eq('lead_id',leadId).order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data||[]},
    async createEvent(payload){const row={lead_id:payload.lead_id||null,type:payload.type||payload.event_type||'SYSTEM',idempotency_key:payload.idempotency_key||null,payload:payload.payload||payload.metadata||{}};if(row.idempotency_key){const{data:existing,error:findError}=await client.from(TABLES.events).select('*').eq('idempotency_key',row.idempotency_key).limit(1);if(findError)throw findError;if(existing&&existing[0])return existing[0]}const{data,error}=await client.from(TABLES.events).insert(row).select('*').single();if(error)throw error;return data},
    async listEvents({leadId,type,limit=100}={}){let q=client.from(TABLES.events).select('*').order('created_at',{ascending:false}).limit(limit);if(leadId)q=q.eq('lead_id',leadId);if(type)q=q.eq('type',type);const{data,error}=await q;if(error)throw error;return data||[]},
    async createAudit(payload){const row={lead_id:payload.lead_id||null,action:payload.action||payload.event_type||'SYSTEM',from_status:payload.from_status||null,to_status:payload.to_status||null,actor:payload.actor||'SYSTEM',metadata:payload.metadata||payload.payload||{}};const{data,error}=await client.from(TABLES.audit).insert(row).select('*').single();if(error)throw error;return data}
  });
}
module.exports={createSupabaseRepository};
