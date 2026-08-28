const assert = require('assert');
const { calculateLeadScore } = require('./scoring');

const cold = calculateLeadScore({ fitScore:5, needScore:5, authorityScore:0, budgetScore:0, timingScore:0, intentScore:5 });
assert.equal(cold.total,15);
assert.equal(cold.temperature,'COLD');

const warm = calculateLeadScore({ fitScore:10, needScore:12, authorityScore:6, budgetScore:5, timingScore:8, intentScore:3 });
assert.equal(warm.total,44);
assert.equal(warm.temperature,'WARM');

const qualified = calculateLeadScore({ fitScore:20, needScore:20, authorityScore:15, budgetScore:15, timingScore:15, intentScore:15 });
assert.equal(qualified.total,100);
assert.equal(qualified.temperature,'QUALIFIED');
assert.equal(qualified.readyForSales,true);

// Regression: verified company data materially raises a new lead's score.
const verifiedNew = calculateLeadScore({ status:'NEW', companyName:'Empresa Teste', cnpj:'12345678000199' });
assert.equal(verifiedNew.total,21);
assert.equal(verifiedNew.temperature,'COLD');

// Regression: a QUALIFIED lead starts at the sales-priority threshold.
const qualifiedStage = calculateLeadScore({ status:'QUALIFIED', interest:true });
assert.equal(qualifiedStage.total,89);
assert.equal(qualifiedStage.temperature,'QUALIFIED');

console.log('scoring.test.js: ok');
