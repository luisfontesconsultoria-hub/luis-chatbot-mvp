/** Unified day planner: CRM tasks + appointments + route stops, without inventing external data. */
const { buildDailyOperations } = require('./daily-operations');
const { routeOrder } = require('../commercial-assistant');

function buildCommandCenter({events=[],appointments=[],routeStops=[],now=Date.now()}={}){
  const tasks=buildDailyOperations(events,now);
  const agenda=(appointments||[]).map(a=>({id:a.id||null,leadId:a.leadId||a.lead_id||null,startAt:a.startAt||a.start_at||null,endAt:a.endAt||a.end_at||null,status:a.status||'PENDING',mode:a.mode||'PRESENCIAL',confirmed:Boolean(a.confirmed)})).sort((a,b)=>(Date.parse(a.startAt||'9999-12-31')||Number.MAX_SAFE_INTEGER)-(Date.parse(b.startAt||'9999-12-31')||Number.MAX_SAFE_INTEGER));
  const route=routeOrder(routeStops||[]);
  return {generatedAt:new Date(now).toISOString(),tasks,agenda,route:{count:route.length,stops:route,hasRealTravelData:route.length>0&&route.every(s=>Number.isFinite(Number(s.travelMinutes))),optimization:route.length>0&&route.every(s=>Number.isFinite(Number(s.travelMinutes)))?'priority_then_travel_time':'priority_only'}};
}
module.exports={buildCommandCenter};
