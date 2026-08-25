const { login, authenticate, logout, configured } = require('./auth');
function assert(c,m){if(!c)throw new Error(m)}
const env={CRM_ADMIN_USER:'admin',CRM_ADMIN_PASSWORD:'strong-test-password'};
assert(configured(env),'auth should report configured');
let failed=false;try{login('admin','wrong',env)}catch(e){failed=e.message==='INVALID_CREDENTIALS'}assert(failed,'invalid credentials must fail');
const session=login('admin','strong-test-password',env);assert(session.token&&session.user==='admin','login must create session');
assert(authenticate(session.token,env)?.user==='admin','session must authenticate');
logout(session.token);assert(!authenticate(session.token,env),'logout must invalidate session');
assert(!configured({}),'missing credentials must report unconfigured');
console.log('PASS CRM auth checks');
