/** Tenant access boundary. Keep tenant isolation separate from billing logic. */
function assertTenantAccess(requestTenantId, resourceTenantId) {
  if (!requestTenantId || !resourceTenantId || requestTenantId !== resourceTenantId) {
    throw new Error('TENANT_ACCESS_DENIED');
  }
  return true;
}

function assertActiveTenant(licenseResult) {
  if (!licenseResult || licenseResult.valid !== true) {
    throw new Error('TENANT_LICENSE_REQUIRED');
  }
  return true;
}

module.exports = { assertTenantAccess, assertActiveTenant };
