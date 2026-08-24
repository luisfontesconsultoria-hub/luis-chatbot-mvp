/** Pure daily operations planner. It reads persisted events through a repository and never invents external calendar/map data. */
const { scoreLead, priority } = require('../commercial-assistant');

function eventTime(event){const v=event?.payload?.dueAt||event?.payload?.startAt||event?.created_at||null;const t=v?Date.parse(v):NaN;return Number.isFinite(t)?t:Number.MAX_SAFE_INTEGER}
function rankTask(task){const p=String(task.priority||'LOW').toUpperCase();const weight=p==='HIGH'?3:p==='MEDIUM'?2:1;return weight}
function buildDailyOperations(events=[], now=Date.now()){
  return events.map(e=>{const payload=e.payload||{};const task={id:e.id||null,type:e.type||'SYSTEM',leadId:e.lead_id||null,dueAt:payload.dueAt||payload.startAt||null,nextAction:payload.action||payload.nextAction||null,priority:payload.leadPriority||payload.priority||'LOW',note:payload.note||payload.reason||''};return task}).sort((a,b)=>(rankTask(b)-rankTask(a))||(eventTime(a)-eventTime(b))).map((x,i)=>({...x,order:i+1,overdue:x.dueAt?Date.parse(x.dueAt)<now:false}));
}

async function getDailyOperations(repo,{leadId,limit=100}={}){
  const events=await repo.listEvents({leadId,limit});
  const operations=buildDailyOperations(events);
  return {count:operations.length,overdueCount:operations.filter(x=>x.overdue).length,operations};
}

function leadOperationalSnapshot(lead={}){const score=scoreLead(lead);return{id:lead.id||null,companyName:lead.companyName||null,status:lead.status||'NEW',score,priority:priority(score),nextAction:lead.nextAction||null,location:{address:lead.address||null,city:lead.city||null,state:lead.state||null}}}
module.exports={buildDailyOperations,getDailyOperations,leadOperationalSnapshot};
