const { searchGooglePlaces } = require('../backend/prospecting/google-places');
const { generateApproaches } = require('../backend/prospecting/approaches');

function prospectingRoute({ method, path, body = {}, authorized }) {
  if (!authorized()) return Promise.resolve({ status: 401, body: { error: 'CRM_AUTH_REQUIRED' } });
  if (method === 'POST' && path === '/api/prospecting/search') {
    return searchGooglePlaces({ ddd: body.ddd, businessType: body.businessType, quantity: body.quantity })
      .then(data => ({ status: 200, body: data }))
      .catch(error => ({ status: error.message === 'GOOGLE_PLACES_API_KEY_NOT_CONFIGURED' ? 503 : 400, body: { error: error.message } }));
  }
  if (method === 'POST' && path === '/api/prospecting/approaches') {
    return generateApproaches({ businessType: body.businessType, companyName: body.companyName, region: body.region, lead: body.lead || {} })
      .then(approaches => ({ status: 200, body: { approaches } }))
      .catch(error => ({ status: error.message === 'GEMINI_API_KEY_NOT_CONFIGURED' || error.message === 'AI_PROVIDER_NOT_SUPPORTED' ? 503 : 502, body: { error: error.message } }));
  }
  return Promise.resolve({ status: 404, body: { error: 'PROSPECTING_ROUTE_NOT_FOUND' } });
}

module.exports = { prospectingRoute };
