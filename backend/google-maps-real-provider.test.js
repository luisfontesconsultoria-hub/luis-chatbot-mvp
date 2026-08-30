const assert = require('node:assert/strict');
const { createGoogleMapsPlacesProvider } = require('./google-maps-real-provider');

let captured;
const fetchImpl = async (url, options) => {
  captured = { url, options };
  return { ok: true, async json() { return { places: [{ id: 'p1', displayName: { text: 'Empresa Teste' }, nationalPhoneNumber: '+55 51 99999-0000', formattedAddress: 'Porto Alegre - RS', types: ['restaurant'] }] }; } };
};

(async () => {
  const provider = createGoogleMapsPlacesProvider({ apiKey: 'test-key', fetchImpl });
  const places = await provider.search({ textQuery: 'restaurantes em Porto Alegre' });
  assert.equal(captured.url, 'https://places.googleapis.com/v1/places:searchText');
  assert.equal(captured.options.headers['X-Goog-Api-Key'], 'test-key');
  assert.equal(places[0].phone, '+55 51 99999-0000');
  assert.equal(places[0].source, 'GOOGLE_MAPS');
  console.log('google-maps-real-provider: PASS');
})().catch(error => { console.error(error); process.exitCode = 1; });
