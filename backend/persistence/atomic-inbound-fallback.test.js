// Regressão P0 (PR #14): deploy antes da migration 20260923 não pode derrubar o inbound.
// Sem a RPC (PGRST202), o pipeline deve cair no caminho legado, rodar o SDR uma vez
// e não chamar a RPC de novo a cada mensagem (recheck em 5 min).
const assert=require('assert');
const{createSupabaseRepository}=require('./supabase-adapter');
const{createWebhookPipeline}=require('../../server/webhook-pipeline');
function fakeClient({rpcError}){
  const db={leads:[],messages:[],events:[]};let rpcCalls=0,seq=0;
  function table(name){
    const st={filters:[],op:'select',row:null};
    const run=()=>{if(st.op==='insert'){const row={id:`${name}-${++seq}`,...st.row};if(name==='events'&&row.idempotency_key&&db.events.some(e=>e.idempotency_key===row.idempotency_key))return{data:null,error:{code:'23505',message:'duplicate key'}};if(name==='messages'&&row.external_message_id&&db.messages.some(m=>m.external_message_id===row.external_message_id))return{data:null,error:{code:'23505',message:'duplicate key'}};db[name].push(row);return{data:row,error:null}}
      if(st.op==='update'){const r=db[name].filter(x=>st.filters.every(([k,v])=>x[k]===v));r.forEach(x=>Object.assign(x,st.row));return{data:r[0]||null,error:null}}
      return{data:db[name].filter(x=>st.filters.every(([k,v])=>x[k]===v)),error:null}};
    const q={select(){return q},insert(r){st.op='insert';st.row=r;return q},update(r){st.op='update';st.row=r;return q},eq(k,v){st.filters.push([k,v]);return q},order(){return q},limit(){return Promise.resolve(run())},single(){const r=run();return Promise.resolve(Array.isArray(r.data)?{data:r.data[0]||null,error:r.data[0]?null:{code:'PGRST116'}}:r)},then(res,rej){return Promise.resolve(run()).then(res,rej)}};
    return q;
  }
  return{db,get rpcCalls(){return rpcCalls},from:table,async rpc(){rpcCalls++;return{data:null,error:rpcError}}};
}
(async()=>{
  const client=fakeClient({rpcError:{code:'PGRST202',message:'Could not find the function public.crm_ingest_whatsapp_inbound(...) in the schema cache'}});
  const repo=createSupabaseRepository(client);const sdrRuns=[];
  const pipeline=createWebhookPipeline({repository:repo,sdrGateway:{async process({lead}){sdrRuns.push(lead.id);return{status:'QUALIFYING'}}}});
  const r1=await pipeline([{external_message_id:'wamid-A',phone:'5551999990001',text:'Oi',timestamp:new Date().toISOString()}]);
  assert.strictEqual(r1[0].status,'processed','sem RPC deve processar pelo caminho legado');
  assert.ok(!r1[0].atomic);assert.strictEqual(sdrRuns.length,1);
  assert.strictEqual(client.db.messages.length,1);assert.ok(client.db.events.some(e=>e.type==='WHATSAPP_INBOUND'));
  const r2=await pipeline([{external_message_id:'wamid-B',phone:'5551999990001',text:'Tudo bem?',timestamp:new Date().toISOString()}]);
  assert.strictEqual(r2[0].status,'processed');assert.strictEqual(client.rpcCalls,1,'não deve martelar a RPC ausente');
  // erro transitório da RPC NÃO pode cair no legado (seria gravação não atômica escondendo queda): vira erro -> spool
  const down=fakeClient({rpcError:{message:'TypeError: fetch failed'}});
  const r3=await createWebhookPipeline({repository:createSupabaseRepository(down)})([{external_message_id:'wamid-C',phone:'5551999990002',text:'x'}]);
  assert.strictEqual(r3[0].status,'error');assert.strictEqual(down.db.messages.length,0);
  // kill switch
  process.env.CRM_ATOMIC_INBOUND='off';
  const off=fakeClient({rpcError:null});
  const r4=await createWebhookPipeline({repository:createSupabaseRepository(off)})([{external_message_id:'wamid-D',phone:'5551999990003',text:'x'}]);
  assert.strictEqual(r4[0].status,'processed');assert.strictEqual(off.rpcCalls,0);
  delete process.env.CRM_ATOMIC_INBOUND;
  console.log('PASS atomic inbound falls back to legacy when RPC is missing');
})().catch(e=>{console.error(e);process.exit(1)});
