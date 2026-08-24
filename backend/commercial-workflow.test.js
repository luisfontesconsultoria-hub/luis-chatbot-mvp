const assert=require('assert');const{applyAppointmentOutcome,applyVisitOutcome,summarizeWorkflow}=require('./commercial-workflow');
let a=applyAppointmentOutcome({id:'1',status:'QUALIFIED'},{confirmed:true,mode:'PRESENCIAL'});assert.equal(a.lead.status,'MEETING_MODE');assert.equal(a.nextAction,'REALIZAR_ATENDIMENTO');
let b=applyAppointmentOutcome({id:'1',status:'QUALIFIED'},{confirmed:false});assert.equal(b.lead.status,'SCHEDULING');assert.equal(b.nextAction,'AGUARDAR_CONFIRMACAO');
let c=applyVisitOutcome({id:'1',status:'MEETING_MODE'},'FOLLOW_UP');assert.equal(c.lead.status,'AGUARDANDO_RETORNO');assert.equal(c.nextAction,'FAZER_FOLLOW_UP');
let d=applyVisitOutcome({id:'1',status:'MEETING_MODE'},'CONVERTED');assert.equal(d.lead.status,'CONVERTIDO');assert.equal(d.nextAction,'REGISTRAR_CONVERSAO');
let e=applyVisitOutcome({id:'1',status:'MEETING_MODE'},'SEM_INTERESSE');assert.equal(e.lead.status,'PERDIDO');assert.equal(e.nextAction,'ENCERRAR_OPORTUNIDADE');
let f=summarizeWorkflow({id:'1',status:'QUALIFIED',appointmentId:'a1',routeId:'r1'});assert.equal(f.appointmentId,'a1');assert.equal(f.routeId,'r1');
console.log('commercial-workflow.test.js: ok');
