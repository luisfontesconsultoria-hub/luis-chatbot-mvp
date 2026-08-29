/** Pure commercial-assistant helpers. No external side effects and no credentials. */
const { calculateLeadScore } = require('./sdr/scoring');

function normalizePhone(v){return String(v||'').replace(/\D/g,'')}
function scoreLead(lead={}){return calculateLeadScore(lead).total}
function temperatureLabel(lead={}){return calculateLeadScore(lead).temperature}
function priority(score){return score>=85?'HIGH':score>=65?'MEDIUM':'LOW'}
function buildLeadSummary(lead={}){const scored=calculateLeadScore(lead);return{lead_id:lead.id||null,score:scored.total,temperature:scored.temperature,readyForSales:scored.readyForSales,priority:priority(scored.total),status:lead.status||'NEW',next_action:lead.nextAction||null,location:{address:lead.address||null,city:lead.city||null,state:lead.state||null,latitude:lead.latitude||null,longitude:lead.longitude||null}}}
function rankAppointmentSlots(slots=[],constraints={}){const start=constraints.startMinutes==null?480:Number(constraints.startMinutes),end=constraints.endMinutes==null?1080:Number(constraints.endMinutes);if(!Number.isFinite(start)||!Number.isFinite(end)||start>end)return[];return slots.filter(s=>Number.isFinite(Number(s.startMinutes))&&Number(s.startMinutes)>=start&&Number(s.startMinutes)<=end).sort((a,b)=>(Number(b.priority||0)-Number(a.priority||0))||(Number(a.travelMinutes||0)-Number(b.travelMinutes||0))||(Number(a.startMinutes)-Number(b.startMinutes)))}
function routeOrder(stops=[]){return [...stops].sort((a,b)=>{const ap=Number(a.priority||0),bp=Number(b.priority||0);if(ap!==bp)return bp-ap;return Number(a.travelMinutes||0)-Number(b.travelMinutes||0)})}
function buildRoutePlan(stops=[],options={}){const ordered=routeOrder(stops);return{date:options.date||null,startAt:options.startAt||null,endAt:options.endAt||null,origin:options.origin||null,stops:ordered,count:ordered.length,hasRealTravelData:ordered.every(s=>Number.isFinite(Number(s.travelMinutes))),optimization:ordered.every(s=>Number.isFinite(Number(s.travelMinutes)))?'priority_then_travel_time':'priority_only'}}
function appointmentToPipelineStatus({confirmed=false,mode='PRESENCIAL'}={}){if(!confirmed)return'SCHEDULING';return'CONFIRMED'}
function visitResultToStatus(result){const v=String(result||'').toUpperCase();if(['CONVERTED','FECHADO','GANHO'].includes(v))return'CONVERTIDO';if(['NO_INTEREST','SEM_INTERESSE','LOST','PERDIDO'].includes(v))return'PERDIDO';if(['FOLLOW_UP','RETORNO','AGUARDANDO_RETORNO'].includes(v))return'AGUARDANDO_RETORNO';return null}
module.exports={normalizePhone,scoreLead,temperatureLabel,priority,buildLeadSummary,rankAppointmentSlots,routeOrder,buildRoutePlan,appointmentToPipelineStatus,visitResultToStatus};
