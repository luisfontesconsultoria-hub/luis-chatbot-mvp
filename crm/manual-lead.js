/** Manual CRM lead input contract. Validation stays server-side before persistence. */
const SOURCES = new Set(['GOOGLE_ADS','META_ADS','INSTAGRAM','WEBSITE','LINKEDIN','WHATSAPP','REFERRAL','FIELD_PROSPECTING','MANUAL','DIRECT']);
function validateManualLead(input = {}) {
  const companyName = String(input.companyName || '').trim();
  const contactName = String(input.contactName || '').trim();
  const phone = String(input.phone || '').trim();
  const source = String(input.source || 'MANUAL').trim().toUpperCase();
  if (!companyName) throw new Error('COMPANY_NAME_REQUIRED');
  if (!contactName) throw new Error('CONTACT_NAME_REQUIRED');
  if (!phone) throw new Error('PHONE_REQUIRED');
  if (!SOURCES.has(source)) throw new Error('INVALID_LEAD_SOURCE');
  return { companyName, contactName, phone, email:String(input.email || '').trim(), cnpj:String(input.cnpj || '').trim(), source, interest:String(input.interest || '').trim(), notes:String(input.notes || '').trim() };
}
module.exports = { validateManualLead };
