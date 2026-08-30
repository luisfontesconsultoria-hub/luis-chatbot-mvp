const { registerProvider, getProvider, listProviders, searchWithProvider } = require('./capture-providers');

beforeEach(() => {
  // Registry is intentionally process-local; unique names keep tests isolated.
});

test('registers and invokes a provider without persistence', async () => {
  registerProvider('test_provider', {
    async search({ query }) { return [{ name: query }]; },
  });

  expect(getProvider('TEST_PROVIDER')).toBeTruthy();
  expect(listProviders()).toContain('test_provider');
  await expect(searchWithProvider('test_provider', { query: 'Empresa' }))
    .resolves.toEqual([{ name: 'Empresa' }]);
});

test('fails clearly for an unknown provider', async () => {
  await expect(searchWithProvider('does_not_exist')).rejects.toThrow('CAPTURE_PROVIDER_NOT_REGISTERED');
});
