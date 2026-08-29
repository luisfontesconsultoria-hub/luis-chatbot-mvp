const assert=require('assert');const {fallbackApproaches}=require('./approaches');
const result=fallbackApproaches({businessType:'restaurante',companyName:'Restaurante Teste',region:'Porto Alegre, RS'});
assert.strictEqual(result.length,3);
assert.deepStrictEqual(result.map(x=>x.key),['CONSULTIVA','DIRETA','SEGMENTADA']);
assert.ok(result.every(x=>x.message.includes('restaurante')));
console.log('approaches.test.js: ok');
