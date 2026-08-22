/** Dashboard aggregation contract; repository implementation stays behind an adapter. */
function buildDashboardModel(rows = []) {
  const model = { total: rows.length, hot: 0, warm: 0, cold: 0, bySource: {}, byStatus: {}, priority: 0 };
  for (const row of rows) {
    const classification = String(row.classification || 'COLD').toUpperCase();
    if (classification === 'HOT') model.hot += 1;
    else if (classification === 'WARM') model.warm += 1;
    else model.cold += 1;
    const source = String(row.source || 'DIRECT').toUpperCase();
    model.bySource[source] = (model.bySource[source] || 0) + 1;
    const status = String(row.status || 'NEW').toUpperCase();
    model.byStatus[status] = (model.byStatus[status] || 0) + 1;
    if (String(row.priority || '').toUpperCase() === 'HIGH') model.priority += 1;
  }
  return model;
}
module.exports = { buildDashboardModel };
