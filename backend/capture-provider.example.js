/**
 * Copy this pattern when adding a future provider.
 * Never put API keys in this file or in Git.
 */

module.exports = {
  name: 'future_provider',
  capabilities: ['search'],

  async search(params = {}) {
    // 1. Read secret from process.env.
    // 2. Call the authorized provider.
    // 3. Return an array compatible with google-maps-capture.v1.
    // 4. Do not persist provider data here.
    return [];
  },
};
