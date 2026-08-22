/** Stable UI/API contract for the owner CRM. */
const LEAD_STATUSES = Object.freeze(['NEW','QUALIFIED','INTERESTED','PROPOSAL','WON','LOST']);

function normalizeLeadForCrm(lead = {}) {
  return {
    id: lead.id || null,
    companyName: lead.companyName || '',
    contactName: lead.contactName || '',
    phone: lead.phone || '',
    source: lead.source || 'DIRECT',
    score: Number.isFinite(Number(lead.score)) ? Number(lead.score) : 0,
    classification: lead.classification || 'COLD',
    status: LEAD_STATUSES.includes(lead.status) ? lead.status : 'NEW',
    queue: lead.queue || 'NURTURE',
    priority: lead.priority || 'LOW',
    nextAction: lead.nextAction || '',
    updatedAt: lead.updatedAt || null
  };
}

module.exports = { LEAD_STATUSES, normalizeLeadForCrm };
