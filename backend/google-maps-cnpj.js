/**
 * Google Maps -> CNPJ enrichment adapter - isolated V1.
 *
 * This layer does not call an external provider and does not persist data.
 * It defines the stable contract for a future authorized CNPJ provider.
 */

const { normalizeCnpj, normalizePhone } = require('./google-maps-capture');

const STATUS = Object.freeze({
  ATIVA: '2',
  SUSPENSA: '3',
  INAPTA: '4',
  BAIXADA: '8',
  NULA: '1',
});

function clean(value) {
  return String(value || '').trim() || null;
}

function normalizeCnpjResponse(raw = {}) {
  const status = raw.situacaoCadastral || raw.situacao_cadastral || {};
  const address = raw.endereco || raw.address || {};
  const cnae = raw.cnaePrincipal || raw.cnae_principal || {};
  const phones = raw.telefone || raw.telefones || [];

  return {
    cnpj: normalizeCnpj(raw.ni || raw.cnpj),
    companyName: clean(raw.nomeEmpresarial || raw.nome_empresarial),
    tradeName: clean(raw.nomeFantasia || raw.nome_fantasia),
    companyStatusCode: clean(status.codigo || status.code),
    companyStatus: clean(status.motivo || status.descricao || status.description),
    companyStatusDate: clean(status.data || status.date),
    openingDate: clean(raw.dataAbertura || raw.data_abertura),
    cnae: clean(cnae.codigo || cnae.code),
    cnaeDescription: clean(cnae.descricao || cnae.description),
    legalNature: clean(raw.naturezaJuridica?.codigo || raw.natureza_juridica?.codigo),
    legalNatureDescription: clean(raw.naturezaJuridica?.descricao || raw.natureza_juridica?.descricao),
    porte: clean(raw.porte || raw.porteEmpresa || raw.porte_empresa),
    isMei: raw.isMei ?? raw.mei ?? raw.opcaoSimei ?? raw.opcao_simei ?? null,
    isSimples: raw.isSimples ?? raw.simples ?? raw.opcaoSimples ?? raw.opcao_simples ?? null,
    email: clean(raw.correioEletronico || raw.email),
    phone: normalizePhone(phones?.[0]?.ddd && phones?.[0]?.numero ? `${phones[0].ddd}${phones[0].numero}` : raw.phone),
    address: clean([address.tipoLogradouro, address.logradouro, address.numero, address.complemento].filter(Boolean).join(', ')),
    neighborhood: clean(address.bairro || address.neighborhood),
    city: clean(address.municipio?.descricao || address.city),
    state: clean(address.uf || address.state)?.toUpperCase().slice(0, 2) || null,
    zipCode: clean(address.cep || address.zipCode),
    raw,
  };
}

function classifyCnpjStatus(code) {
  switch (String(code || '')) {
    case STATUS.ATIVA: return 'ACTIVE';
    case STATUS.SUSPENSA: return 'SUSPENDED';
    case STATUS.INAPTA: return 'INACTIVE';
    case STATUS.BAIXADA: return 'CLOSED';
    case STATUS.NULA: return 'NULL';
    default: return 'UNKNOWN';
  }
}

function enrichPlaceWithCnpj(place, cnpjResponse) {
  const cnpj = normalizeCnpj(cnpjResponse?.ni || cnpjResponse?.cnpj || place?.cnpj);
  if (!cnpj) return { ...place, cnpj: null, cnpjLookup: 'NOT_FOUND' };

  const company = normalizeCnpjResponse({ ...cnpjResponse, cnpj });
  return {
    ...place,
    cnpj,
    companyName: company.companyName || place.companyName || null,
    tradeName: company.tradeName || place.tradeName || place.name || null,
    companyStatusCode: company.companyStatusCode,
    companyStatus: company.companyStatus,
    companyStatusClass: classifyCnpjStatus(company.companyStatusCode),
    companyStatusDate: company.companyStatusDate,
    openingDate: company.openingDate,
    cnae: company.cnae,
    cnaeDescription: company.cnaeDescription,
    legalNature: company.legalNature,
    legalNatureDescription: company.legalNatureDescription,
    porte: company.porte,
    isMei: company.isMei,
    isSimples: company.isSimples,
    email: company.email,
    cnpjPhone: company.phone,
    cnpjAddress: company.address,
    cnpjNeighborhood: company.neighborhood,
    cnpjCity: company.city,
    cnpjState: company.state,
    cnpjZipCode: company.zipCode,
    cnpjLookup: 'FOUND',
  };
}

function evaluateLeadEligibility(lead, options = {}) {
  const allowSuspended = options.allowSuspended === true;
  const excludeMei = options.excludeMei === true;
  const statusClass = lead.companyStatusClass || classifyCnpjStatus(lead.companyStatusCode);
  const reasons = [];

  if (!lead.cnpj) reasons.push('MISSING_CNPJ');
  if (statusClass === 'CLOSED') reasons.push('CNPJ_CLOSED');
  if (statusClass === 'NULL') reasons.push('CNPJ_NULL');
  if (statusClass === 'INACTIVE') reasons.push('CNPJ_INACTIVE');
  if (statusClass === 'SUSPENDED' && !allowSuspended) reasons.push('CNPJ_SUSPENDED');
  if (excludeMei && lead.isMei === true) reasons.push('MEI_EXCLUDED');

  return {
    ...lead,
    eligibility: reasons.length ? 'REJECTED' : 'ELIGIBLE',
    eligibilityReasons: reasons,
  };
}

module.exports = {
  STATUS,
  normalizeCnpjResponse,
  classifyCnpjStatus,
  enrichPlaceWithCnpj,
  evaluateLeadEligibility,
};
