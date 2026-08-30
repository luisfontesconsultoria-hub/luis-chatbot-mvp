const { runCaptureStation } = require('./google-maps-station');

test('runs capture through scoring and produces CRM-ready output without persistence', () => {
  const result = runCaptureStation([
    { name: 'Empresa Nova', phone: '(51) 99999-0000', cnpj: '04.252.011/0001-10', city: 'Porto Alegre', category: 'Servicos' },
  ], {
    cnpjResolver: () => ({ ni: '04.252.011/0001-10', nomeEmpresarial: 'EMPRESA NOVA LTDA', situacaoCadastral: { codigo: '2', motivo: 'ATIVA' }, cnaePrincipal: { codigo: '1234567', descricao: 'Servicos' } }),
  });
  expect(result.summary.captured).toBe(1);
  expect(result.summary.eligible).toBe(1);
  expect(result.readyForCrm[0]).toMatchObject({ source: 'GOOGLE_MAPS', cnpj: '04252011000110', commercialPriority: 'HIGH' });
});

test('keeps filtered leads out of CRM-ready output', () => {
  const result = runCaptureStation([{ name: 'Empresa', phone: '51999990000', city: 'Porto Alegre' }], { filters: { requireActiveCnpj: true } });
  expect(result.summary.review).toBe(1);
  expect(result.readyForCrm).toHaveLength(0);
});
