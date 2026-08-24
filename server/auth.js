const crypto=require('crypto');
const TTL_MS=12*60*60*1000;
const revoked=new Map();

function credentials(env=process.env){return {user:String(env.CRM_ADMIN_USER||'').trim(),password:String(env.CRM_ADMIN_PASSWORD||'')}}
function secret(env=process.env){const c=credentials(env);return String(env.CRM_AUTH_SECRET||c.password||'crm-auth-secret')}
function encode(value){return Buffer.from(String(value),'utf8').toString('base64url')}
function sign(value,env=process.env){return crypto.createHmac('sha256',secret(env)).update(value).digest('base64url')}
function makeToken(user,expiresAt,env=process.env){const payload=`v1.${encode(user)}.${expiresAt}`;return `${payload}.${sign(payload,env)}`}
function cleanupRevoked(now=Date.now()){for(const [token,expiresAt] of revoked){if(expiresAt<=now)revoked.delete(token)}}
function login(user,password,env=process.env){const c=credentials(env);if(!c.user||!c.password||user!==c.user||password!==c.password)throw new Error('INVALID_CREDENTIALS');cleanupRevoked();const expiresAt=Date.now()+TTL_MS;return{token:makeToken(user,expiresAt,env),expiresIn:TTL_MS/1000,user}}
function authenticate(token,env=process.env){const raw=String(token||'');cleanupRevoked();if(revoked.has(raw))return null;const parts=raw.split('.');if(parts.length!==4||parts[0]!=='v1')return null;const payload=parts.slice(0,3).join('.');const expected=sign(payload,env);const a=Buffer.from(parts[3]);const b=Buffer.from(expected);if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;const expiresAt=Number(parts[2]);if(!Number.isFinite(expiresAt)||expiresAt<Date.now())return null;let user='';try{user=Buffer.from(parts[1],'base64url').toString('utf8')}catch{return null}const c=credentials(env);if(!user||user!==c.user)return null;return{user,expiresAt}}
function logout(token){const raw=String(token||'');if(!raw)return;const parts=raw.split('.');const expiresAt=Number(parts[2]);revoked.set(raw,Number.isFinite(expiresAt)?expiresAt:Date.now()+TTL_MS);cleanupRevoked()}
function configured(env=process.env){const c=credentials(env);return Boolean(c.user&&c.password)}
module.exports={login,authenticate,logout,configured};
