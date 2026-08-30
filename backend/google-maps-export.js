/** Export-only layer. It never writes to CRM or external storage. */
function toExportRecord(lead = {}) {
  return { captureId: lead.captureId || null, source: 'GOOGLE_MAPS', placeId: lead.placeId || null, name: lead.companyName || lead.tradeName || lead.name || null, cnpj: lead.cnpj || null, phone: lead.cnpjPhone || lead.phone || null, email: lead.email || null, cnae: lead.cnae || null, cnaeDescription: lead.cnaeDescription || null, companyStatusClass: lead.companyStatusClass || null, city: lead.cnpjCity || lead.city || null, state: lead.cnpjState || lead.state || null, commercialScore: lead.commercialScore ?? null, commercialPriority: lead.commercialPriority || null, eligibility: lead.eligibility || null, eligibilityReasons: lead.eligibilityReasons || [], mapsUrl: lead.mapsUrl || null };
}
function exportReadyBatch(leads = []) { return leads.filter(l => l && l.eligibility === 'ELIGIBLE').map(toExportRecord); }
module.exports = { toExportRecord, exportReadyBatch };
