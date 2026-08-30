/**
 * Converts an eligible Google Maps/CNPJ record into the existing CRM lead shape.
 * No database writes are performed here.
 */

function toCrmLead(lead = {}) {
  return {
    name: lead.companyName || lead.tradeName || lead.name || null,
    companyName: lead.companyName || lead.name || null,
    tradeName: lead.tradeName || lead.name || null,
    phone: lead.cnpjPhone || lead.phone || null,
    cnpj: lead.cnpj || null,
    source: 'GOOGLE_MAPS',
    campaign: lead.campaign || null,
    interest: lead.interest || null,
    productInterest: lead.productInterest || lead.interest || null,
    status: lead.status || 'NOVO',
    companyStatus: lead.companyStatus || null,
    address: lead.cnpjAddress || lead.address || null,
    city: lead.cnpjCity || lead.city || null,
    state: lead.cnpjState || lead.state || null,
    zipCode: lead.cnpjZipCode || lead.zipCode || null,
    neighborhood: lead.cnpjNeighborhood || lead.neighborhood || null,
    nextAction: lead.nextAction || 'PROSPECTAR',
    mapsUrl: lead.mapsUrl || null,
    category: lead.category || null,
    cnae: lead.cnae || null,
    cnaeDescription: lead.cnaeDescription || null,
    porte: lead.porte || null,
    isMei: lead.isMei ?? null,
    isSimples: lead.isSimples ?? null,
    captureQualification: lead.qualification || null,
    cnpjLookup: lead.cnpjLookup || null,
    eligibility: lead.eligibility || null,
  };
}

module.exports = { toCrmLead };
