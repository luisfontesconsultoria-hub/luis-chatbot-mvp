const assert=require('assert');const {normalizeDdd,regionForDdd,normalizePlace}=require('./google-places');
assert.strictEqual(normalizeDdd('51'),'51');
assert.strictEqual(normalizeDdd('(51)'),'51');
assert.strictEqual(regionForDdd('51'),'Porto Alegre, RS');
assert.strictEqual(regionForDdd('71'),'Salvador, BA');
assert.strictEqual(regionForDdd('00'),null);
const place=normalizePlace({id:'place-1',displayName:{text:'Restaurante Teste'},formattedAddress:'Rua Teste, 10, Porto Alegre - RS',nationalPhoneNumber:'(51) 99999-9999',rating:4.6,userRatingCount:120,googleMapsUri:'https://maps.google.com/?cid=1',types:['restaurant']});
assert.deepStrictEqual(place,{placeId:'place-1',name:'Restaurante Teste',address:'Rua Teste, 10, Porto Alegre - RS',phone:'(51) 99999-9999',website:'',rating:4.6,reviewCount:120,mapsUrl:'https://maps.google.com/?cid=1',types:['restaurant'],source:'GOOGLE_PLACES'});
console.log('google-places.test.js: ok');
