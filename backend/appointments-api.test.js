const assert=require('assert');
const{appointmentsRoute}=require('./appointments-api');
const leads=new Map([['lead-1',{id:'lead-1',status:'AGUARDANDO_CONFIRMACAO_AGENDA'}]]);
const events=[];
const runtime={repository:{
 getLead:async id=>leads.get(id)||null,
 updateLead:async(id,fields)=>{const l={...leads.get(id),...fields};leads.set(id,l);return l},
 listEvents:async()=>events,
 createEvent:async e=>events.push(e),
 createAudit:async()=>{}
}};
(async()=>{
 let r=await appointmentsRoute({method:'POST',path:'/api/crm/appointments',body:{leadId:'lead-1',clientName:'Ana',date:'2026-08-29',time:'14:30',type:'VISITA'},runtime});
 assert.equal(r.status,201);
 assert.equal(leads.get('lead-1').status,'AGUARDANDO_CONFIRMACAO_AGENDA');
 const id=r.body.appointment.appointmentId;
 r=await appointmentsRoute({method:'PATCH',path:`/api/crm/appointments/${id}`,body:{status:'CONFIRMED'},runtime});
 assert.equal(r.status,200);
 assert.equal(r.body.lead.status,'CONFIRMED');
 assert.equal(leads.get('lead-1').appointmentId,id);
 console.log('PASS appointments API lead integration');
})().catch(e=>{console.error(e);process.exit(1)});
