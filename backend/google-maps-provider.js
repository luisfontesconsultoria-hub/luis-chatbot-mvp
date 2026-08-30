/**
 * Google Maps provider adapter.
 * The adapter accepts already-authorized/obtained Maps results and keeps the
 * capture station independent from the acquisition mechanism.
 */

const { buildCaptureBatch } = require('./google-maps-capture');

function createGoogleMapsProvider() {
  return {
    name: 'google_maps',
    capabilities: ['search', 'capture'],
    async search({ places = [] } = {}) {
      return buildCaptureBatch(places);
    },
  };
}

module.exports = { createGoogleMapsProvider };
