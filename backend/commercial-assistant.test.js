const assert=require('assert');const{scoreLead,priority,rankAppointmentSlots,routeOrder}=require('./commercial-assistant');
assert(scoreLead({status:'NEW',cnpj:'123',companyName:'Empresa'})>20);assert.strictEqual(priority(95),'HIGH');assert.strictEqual(priority(70),'MEDIUM');assert.strictEqual(priority(40),'LOW');
assert.deepStrictEqual(rankAppointmentSlots([{startMinutes:900,travelMinutes:20},{startMinutes:600,travelMinutes:5}],{startMinutes:700,endMinutes:1000}).map(x=>x.startMinutes),[900]);
assert.deepStrictEqual(routeOrder([{id:'A',priority:50,travelMinutes:20},{id:'B',priority:90,travelMinutes:60}]).map(x=>x.id),['B','A']);
console.log('commercial-assistant.test.js: ok');
