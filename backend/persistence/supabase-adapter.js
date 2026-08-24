/** Server-side Supabase adapter. The existing V1 production schema remains the source of truth. */
const { TABLES, assertRepository } = require('./supabase-contract');
const { toDbLead, fromDbLead } = require('./crm-mapper');
function cleanRow(row={}){const out={};for(const [k,v] of Object.entries(row)){if(v===undefined||v===null)continue;if(typeof v==='string'&&v.trim()==='')continue;out[k]=v}return out}
function baseLeadRow(row){const allowed=['nome','nome_da_empresa','telefone','cnpj','fonte','campanha','interesse_no_produto','corrente_bancaria','corrente_da_maquina','receita_mensal','ponto_de_dor','status','owner','próxima_ação','address','city','state','zip_code'];const out={};for(const k of allowed)if(row[k]!==undefined)out[k]=row[k];return cleanRow(out)}
function optionalLeadRow(row){const allowed=['atualizado_em','status_da_empresa','nome_comercial','vizinhança','número_do_endereço'];const out={};for(const k of allowed)if(row[k]!==undefined)out[k]=row[k];return cleanRow(out)}
function createSupabaseRepository(client) {
  if (!client || typeof client.from !== 'function') throw new Error('SUPABASE_CLIENT_REQUIRED');
  return assertRepository({
    async listLeads({limit=50,source,status}={}){let q=client.from(TABLES.leads).select('*').limit(limit);if(source)q=q.eq('fonte',source);if(status)q=q.eq('status',status);const{data,error}=await q;if(error)throw error;return(data||[]).map(fromDbLead)},
    async getLead(id){const{data,error}=await client.from(TABLES.leads).select('*').eq('id',id).single();if(error&&error.code!=='PGRST116')throw error;return data?fromDbLead(data):null},
    async findOrCreateLeadByPhone(phone,defaults={}){if(!phone)throw new Error('PHONE_REQUIRED');const normalized=String(phone).replace(/\D/g,'');const{data:existing,error}=await client.from(TABLES.leads).select('*').eq('telefone',normalized).limit(1);if(error)throw error;if(existing&&existing[0])return fromDbLead(existing[0]);return this.createLead({phone:normalized,source:defaults.source||'WHATSAPP'})},
    async createLead(payload){
      const row=cleanRow(toDbLead(payload));
      const full=await client.from(TABLES.leads).insert(row).select('*').single();
      if(!full.error)return fromDbLead(full.data);
      if(full.error.code==='23505'){
        const phone=row.telefone?String(row.telefone).replace(/\D/g,''):'';const cnpj=row.cnpj?String(row.cnpj).replace(/\D/g,''):'';let existing=null;
        if(phone){const r=await client.from(TABLES.leads).select('*').eq('telefone',phone).limit(1);if(!r.error&&r.data?.[0])existing=r.data[0]}
        if(!existing&&cnpj){const r=await client.from(TABLES.leads).select('*').eq('cnpj',cnpj).limit(1);if(!r.error&&r.data?.[0])existing=r.data[0]}
        if(existing)return fromDbLead(existing);
      }
      const base=baseLeadRow(row);
      const retry=await client.from(TABLES.leads).insert(base).select('*').single();
      if(!retry.error){
        const optional=optionalLeadRow(row);if(Object.keys(optional).length){try{const updated=await client.from(TABLES.leads).update(optional).eq('id',retry.data.id).select('*').single();if(!updated.error)return fromDbLead(updated.data)}catch{}}
        return fromDbLead(retry.data);
      }
      if(retry.error?.code==='23505'){
        const phone=base.telefone?String(base.telefone).replace(/\D/g,''):'';const cnpj=base.cnpj?String(base.cnpj).replace(/\D/g,''):'';let existing=null;
        if(phone){const r=await client.from(TABLES.leads).select('*').eq('telefone',phone).limit(1);if(!r.error&&r.data?.[0])existing=r.data[0]}
        if(!existing&&cnpj){const r=await client.from(TABLES.leads).select('*').eq('cnpj',cnpj).limit(1);if(!r.error&&r.data?.[0])existing=r.data[0]}
        if(existing)return fromDbLead(existing);
      }
      throw retry.error||full.error;
    },
    async updateLead(id,patch){const{data,error}=await client.from(TABLES.leads).update(cleanRow(toDbLead(patch))).eq('id',id).select('*').single();if(error)throw error;return fromDbLead(data)},
    async createMessage(payload){const row={lead_id:payload.lead_id,channel:payload.channel||'WHATSAPP',direction:payload.direction||'INBOUND',external_message_id:payload.external_message_id||null,text_content:payload.text_content!==undefined?payload.text_content:(payload.text||''),transcript:payload.transcript||null,metadata:payload.metadata||{}};const{data,error}=await client.from(TABLES.messages).insert(row).select('*').single();if(error)throw error;return data},
    async listMessages({leadId,limit=100}={}){const{data,error}=await client.from(TABLES.messages).select('*').eq('lead_id',leadId).order('created_at',{ascending:false}).limit(limit);if(error)throw error;return data||[]},
    async createEvent(payload){const row={lead_id:payload.lead_id||null,type:payload.type||payload.event_type||'SYSTEM',idempotency_key:payload.idempotency_key||null,payload:payload.payload||payload.metadata||{}};if(row.idempotency_key){const{data:existing,error:findError}=await client.from(TABLES.events).select('*').eq('idempotency_key',row.idempotency_key).limit(1);if(findError)return null;if(existing&&existing[0])return existing[0]}const{data,error}=await client.from(TABLES.events).insert(row).select('*').single();if(error)return null;return data},
    async listEvents({leadId,type,limit=100}={}){let q=client.from(TABLES.events).select('*').order('created_at',{ascending:false}).limit(limit);if(leadId)q=q.eq('lead_id',leadId);if(type)q=q.eq('type',type);const{data,error}=await q;if(error)throw error;return data||[]},
    async createAudit(payload){const row={lead_id:payload.lead_id||null,action:payload.action||payload.event_type||'SYSTEM',from_status:payload.from_status||null,to_status:payload.to_status||null,actor:payload.actor||'SYSTEM',metadata:payload.metadata||payload.payload||{}};const{data,error}=await client.from(TABLES.audit).insert(row).select('*').single();if(error)throw error;return data}
  });
}
module.exports={createSupabaseRepository};
