const DDD_REGIONS = {
  '11':'São Paulo, SP','12':'São José dos Campos, SP','13':'Santos, SP','14':'Bauru, SP','15':'Sorocaba, SP','16':'Ribeirão Preto, SP','17':'São José do Rio Preto, SP','18':'Presidente Prudente, SP','19':'Campinas, SP',
  '21':'Rio de Janeiro, RJ','22':'Campos dos Goytacazes, RJ','24':'Volta Redonda, RJ','27':'Vitória, ES','28':'Cachoeiro de Itapemirim, ES','31':'Belo Horizonte, MG','32':'Juiz de Fora, MG','33':'Governador Valadares, MG','34':'Uberlândia, MG','35':'Poços de Caldas, MG','37':'Divinópolis, MG','38':'Montes Claros, MG',
  '41':'Curitiba, PR','42':'Ponta Grossa, PR','43':'Londrina, PR','44':'Maringá, PR','45':'Foz do Iguaçu, PR','46':'Francisco Beltrão, PR','47':'Joinville, SC','48':'Florianópolis, SC','49':'Chapecó, SC','51':'Porto Alegre, RS','53':'Pelotas, RS','54':'Caxias do Sul, RS','55':'Santa Maria, RS',
  '61':'Brasília, DF','62':'Goiânia, GO','63':'Palmas, TO','64':'Rio Verde, GO','65':'Cuiabá, MT','66':'Rondonópolis, MT','67':'Campo Grande, MS','68':'Rio Branco, AC','69':'Porto Velho, RO','71':'Salvador, BA','73':'Ilhéus, BA','74':'Juazeiro, BA','75':'Feira de Santana, BA','77':'Barreiras, BA','79':'Aracaju, SE',
  '81':'Recife, PE','82':'Maceió, AL','83':'João Pessoa, PB','84':'Natal, RN','85':'Fortaleza, CE','86':'Teresina, PI','87':'Petrolina, PE','88':'Juazeiro do Norte, CE','89':'Picos, PI','91':'Belém, PA','92':'Manaus, AM','93':'Santarém, PA','94':'Marabá, PA','95':'Boa Vista, RR','96':'Macapá, AP','97':'Coari, AM','98':'São Luís, MA','99':'Imperatriz, MA'
};

function normalizeDdd(value) {
  const d = String(value || '').replace(/\D/g, '').slice(-2);
  return d.length === 2 ? d : '';
}

function regionForDdd(ddd) {
  return DDD_REGIONS[normalizeDdd(ddd)] || null;
}

function cleanText(value, max = 240) {
  return String(value || '').trim().slice(0, max);
}

function normalizePlace(place = {}) {
  const displayName = place.displayName?.text || place.displayName?.name || '';
  return {
    placeId: place.id || null,
    name: cleanText(displayName, 180),
    address: cleanText(place.formattedAddress, 300),
    phone: cleanText(place.nationalPhoneNumber || place.internationalPhoneNumber, 40),
    website: cleanText(place.websiteUri, 500),
    rating: Number.isFinite(Number(place.rating)) ? Number(place.rating) : null,
    reviewCount: Number.isFinite(Number(place.userRatingCount)) ? Number(place.userRatingCount) : null,
    mapsUrl: cleanText(place.googleMapsUri, 1000),
    types: Array.isArray(place.types) ? place.types.slice(0, 10) : [],
    source: 'GOOGLE_PLACES'
  };
}

async function searchGooglePlaces({ ddd, businessType, quantity = 20 }, env = process.env) {
  const apiKey = env.GOOGLE_MAPS_API_KEY || env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) throw new Error('GOOGLE_PLACES_API_KEY_NOT_CONFIGURED');
  const normalizedDdd = normalizeDdd(ddd);
  if (!normalizedDdd) throw new Error('DDD_REQUIRED');
  const type = cleanText(businessType, 100);
  if (!type) throw new Error('BUSINESS_TYPE_REQUIRED');
  const requested = Math.max(1, Math.min(Number(quantity) || 20, 60));
  const region = regionForDdd(normalizedDdd);
  if (!region) throw new Error('DDD_NOT_MAPPED');

  const url = 'https://places.googleapis.com/v1/places:searchText';
  const fieldMask = [
    'places.id','places.displayName','places.formattedAddress','places.nationalPhoneNumber',
    'places.websiteUri','places.rating','places.userRatingCount','places.googleMapsUri','places.types'
  ].join(',');
  const results = [];
  let pageToken = null;
  for (let page = 0; page < 3 && results.length < requested; page += 1) {
    const body = {
      textQuery: `${type} em ${region}, Brasil`,
      pageSize: Math.min(20, requested - results.length),
      regionCode: 'BR',
      languageCode: 'pt-BR'
    };
    if (pageToken) body.pageToken = pageToken;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`GOOGLE_PLACES_HTTP_${response.status}`);
    const data = await response.json();
    for (const place of Array.isArray(data.places) ? data.places : []) results.push(normalizePlace(place));
    pageToken = data.nextPageToken || null;
    if (!pageToken) break;
  }

  const unique = [];
  const seen = new Set();
  for (const item of results) {
    const key = item.placeId || `${item.name}|${item.address}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  return { ddd: normalizedDdd, region, businessType: type, requested, results: unique.slice(0, requested) };
}

module.exports = { searchGooglePlaces, normalizeDdd, regionForDdd, DDD_REGIONS };
