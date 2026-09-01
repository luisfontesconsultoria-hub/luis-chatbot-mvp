const assert = require('assert');
const { importCompanies } = require('./captacao-import');

(async () => {
  const companies = [];
  const repository = {
    async findDuplicateCompany({ phone, cnpj, name, address }) {
      return companies.find(c =>
        (cnpj && c.cnpj === cnpj) ||
        (phone && c.phone === phone) ||
        (name && address && c.name === name && c.address === address)
      ) || null;
    },
    async createCapturedCompany(data) {
      const company = { id: String(companies.length + 1), ...data };
      companies.push(company);
      return company;
    }
  };

  const first = await importCompanies({
    repository,
    source: 'CSV',
    rows: [{
      name: 'Smoke Test Empresa',
      phone: '(51) 99999-0000',
      cnpj: '12.345.678/0001-90',
      address: 'Rua Smoke, 100',
      city: 'Porto Alegre',
      state: 'RS'
    }]
  });

  assert.strictEqual(first.status, 200);
  assert.strictEqual(first.body.summary.created, 1);
  assert.strictEqual(companies.length, 1);
  assert.strictEqual(companies[0].phone, '51999990000');
  assert.strictEqual(companies[0].cnpj, '12345678000190');
  assert.strictEqual(companies[0].source, 'CSV');

  const second = await importCompanies({
    repository,
    source: 'CSV',
    rows: [{
      name: 'Smoke Test Empresa',
      phone: '51999990000',
      cnpj: '12345678000190',
      address: 'Rua Smoke, 100'
    }]
  });

  assert.strictEqual(second.status, 200);
  assert.strictEqual(second.body.summary.duplicate, 1);
  assert.strictEqual(companies.length, 1);

  console.log('PASS captacao V1 smoke: create -> normalize -> dedupe');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
