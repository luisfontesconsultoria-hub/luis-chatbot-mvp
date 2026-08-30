const { toCrmLead } = require('./google-maps-lead-adapter');

test('maps an eligible enriched lead to the existing CRM lead shape', () => {
  expect(toCrmLead({
    companyName: 'EMPRESA EXEMPLO LTDA',
    tradeName: 'EXEMPLO',
    phone: '5133334444',
    cnpj: '04252011000110',
    city: 'Porto Alegre',
    state: 'RS',
    cnae: '1234567',
    isMei: false,
    eligibility: 'ELIGIBLE',
    qualification: 'READY_FOR_CNPJ',
  })).toMatchObject({
    name: 'EMPRESA EXEMPLO LTDA',
    companyName: 'EMPRESA EXEMPLO LTDA',
    tradeName: 'EXEMPLO',
    phone: '5133334444',
    cnpj: '04252011000110',
    source: 'GOOGLE_MAPS',
    city: 'Porto Alegre',
    state: 'RS',
    cnae: '1234567',
    isMei: false,
    eligibility: 'ELIGIBLE',
  });
});
