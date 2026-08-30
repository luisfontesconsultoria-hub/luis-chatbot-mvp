/**
 * Lightweight provider registry for the capture station.
 * Providers are adapters only: they fetch/transform data and return a common
 * capture contract. Secrets stay outside source control.
 */

const providers = new Map();

function registerProvider(name, provider) {
  if (!name || !provider || typeof provider.search !== 'function') {
    throw new TypeError('provider requires a name and search function');
  }
  providers.set(String(name).toLowerCase(), provider);
  return provider;
}

function getProvider(name) {
  return providers.get(String(name || '').toLowerCase()) || null;
}

function listProviders() {
  return [...providers.keys()];
}

async function searchWithProvider(name, params = {}) {
  const provider = getProvider(name);
  if (!provider) throw new Error(`CAPTURE_PROVIDER_NOT_REGISTERED:${name}`);
  return provider.search(params);
}

module.exports = { registerProvider, getProvider, listProviders, searchWithProvider };
