const { assertTenantAccess, assertActiveTenant } = require('./tenant-access');
assertTenantAccess('a','a');
let denied=false; try{assertTenantAccess('a','b')}catch(e){denied=e.message==='TENANT_ACCESS_DENIED';} if(!denied)throw Error('tenant isolation failed');
assertActiveTenant({valid:true});
denied=false; try{assertActiveTenant({valid:false})}catch(e){denied=e.message==='TENANT_LICENSE_REQUIRED';} if(!denied)throw Error('inactive tenant accepted');
console.log('PASS tenant access boundary');
