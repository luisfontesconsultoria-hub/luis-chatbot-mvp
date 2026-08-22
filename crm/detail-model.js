/** Lead detail view contract. Secrets and provider credentials never belong here. */
function buildLeadDetail({ lead, messages = [], notes = [], audit = [] } = {}) {
  if (!lead || !lead.id) throw new Error('LEAD_REQUIRED');
  return {
    lead,
    messages: messages.map(m => ({ id:m.id, direction:m.direction, text:m.text || '', timestamp:m.timestamp || null, mediaType:m.mediaType || null })),
    notes: notes.map(n => ({ id:n.id, text:n.text || '', createdAt:n.createdAt || null })),
    audit: audit.map(a => ({ action:a.action || '', actor:a.actor || 'SYSTEM', timestamp:a.timestamp || null }))
  };
}
module.exports = { buildLeadDetail };
