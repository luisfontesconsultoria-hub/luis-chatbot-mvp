/**
 * Optional live Google Places provider for the capture station.
 * Requires GOOGLE_MAPS_API_KEY in the hosting environment.
 * No key is accepted from request bodies.
 */

function createGoogleMapsPlacesProvider({ apiKey = process.env.GOOGLE_MAPS_API_KEY, fetchImpl = globalThis.fetch } = {}) {
  if (!apiKey) throw new Error('GOOGLE_MAPS_API_KEY_REQUIRED');
  if (typeof fetchImpl !== 'function') throw new Error('FETCH_REQUIRED');

  return {
    name: 'google_maps_places',
    capabilities: ['search', 'capture'],
    async search({ textQuery, languageCode = 'pt-BR', maxResultCount = 20 } = {}) {
      if (!String(textQuery || '').trim()) throw new Error('TEXT_QUERY_REQUIRED');
      const response = await fetchImpl('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.types',
        },
        body: JSON.stringify({ textQuery: String(textQuery).trim(), languageCode, maxResultCount }),
      });
      if (!response.ok) throw new Error(`GOOGLE_PLACES_HTTP_${response.status}`);
      const data = await response.json();
      return (data.places || []).map(place => ({
        placeId: place.id,
        name: place.displayName?.text || '',
        phone: place.nationalPhoneNumber || '',
        address: place.formattedAddress || '',
        website: place.websiteUri || '',
        category: Array.isArray(place.types) ? place.types[0] || '' : '',
        source: 'GOOGLE_MAPS',
      }));
    },
  };
}

module.exports = { createGoogleMapsPlacesProvider };
