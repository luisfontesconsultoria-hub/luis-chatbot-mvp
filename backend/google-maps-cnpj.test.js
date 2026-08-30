const {
  normalizeCnpjResponse,
  classifyCnpjStatus,
  enrichPlaceWithCnpj,
  evaluateLeadEligibility,
} = require('./google-maps-cnpj');

test('normalizes a government-style CNPJ response', () => {
  expect(normalizeCnpjResponse({
    ni: '04.252.011/0001-10',
    nomeEmpresarial: 'EMPRESA EXEMPLO LTDA',
    nomeFantasia: 'EXEMPLO',
    situacaoCadastral: { codigo: '2', motivo: 'ATIVA', data: '20260830' },
    cnaePrincipal: { codigo: '1234567', descricao: 'Atividade exemplo' },
    porteEmpresa: '03',
    opcaoSimei: false,
    opcaoSimples: true,
    endereco: { logradouro: 'Rua A', numero: '10', bairro: 'Centro', cep: '90000000', municipio: { descricao: 'Porto Alegre' }, uf: 'RS' },
    telefone: [{ ddd: '51', numero: '33334444' }],
  })).toMatchObject({
    cnpj: '04252011000110',
    companyName: 'EMPRESA EXEMPLO LTDA',
    tradeName: 'EXEMPLO',
    companyStatusCode: '2',
    cnae: '1234567',
    porte: '03',
    isMei: false,
    isSimples: true,
    phone: '5133334444',
    city: 'Porto Alegre',
    state: 'RS',
  });
});

test('classifies CNPJ status codes', () => {
  expect(classifyCnpjStatus('2')).toBe('ACTIVE');
  expect(classifyCnpjStatus('3')).toBe('SUSPENDED');
  expect(classifyCnpjStatus('4')).toBe('INACTIVE');
  expect(classifyCnpjStatus('8')).toBe('CLOSED');
  expect(classifyCnpjStatus('1')).toBe('NULL');
});

test('enriches a Maps place without persistence side effects', () => {
  const result = enrichPlaceWithCnpj(
    { name: 'Empresa no Maps', phone: '5133334444', source: 'GOOGLE_MAPS' },
    { ni: '04.252.011/0001-10', nomeEmpresarial: 'EMPRESA EXEMPLO LTDA', situacaoCadastral: { codigo: '2', motivo: 'ATIVA' } },
  );

  expect(result).toMatchObject({
    cnpj: '04252011000110',
    companyName: 'EMPRESA EXEMPLO LTDA',
    companyStatusClass: 'ACTIVE',
    cnpjLookup: 'FOUND',
    source: 'GOOGLE_MAPS',
  });
});

test('rejects closed and inactive CNPJs and can exclude MEI', () => {
  expect(evaluateLeadEligibility({ cnpj: '1', companyStatusClass: 'CLOSED' })).toMatchObject({
    eligibility: 'REJECTED',
    eligibilityReasons: ['CNPJ_CLOSED'],
  });

  expect(evaluateLeadEligibility({ cnpj: '1', companyStatusClass: 'ACTIVE', isMei: true }, { excludeMei: true })).toMatchObject({
    eligibility: 'REJECTED',
    eligibilityReasons: ['MEI_EXCLUDED'],
  });
});
