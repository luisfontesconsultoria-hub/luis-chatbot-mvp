/** Pure UI model for the V1 lead list. */
function filterLeads(rows = [], filters = {}) {
  const q = String(filters.query || '').trim().toLowerCase();
  const source = filters.source ? String(filters.source).toUpperCase() : null;
  const status = filters.status ? String(filters.status).toUpperCase() : null;
  const classification = filters.classification ? String(filters.classification).toUpperCase() : null;
  return rows.filter((row) => {
    const matchesQuery = !q || [row.companyName,row.contactName,row.phone].some(v => String(v || '').toLowerCase().includes(q));
    return matchesQuery && (!source || row.source === source) && (!status || row.status === status) && (!classification || row.classification === classification);
  });
}
module.exports = { filterLeads };
