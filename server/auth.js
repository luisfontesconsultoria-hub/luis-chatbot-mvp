const crypto=require('crypto');
const sessions=new Map();
const TTL_MS=12*60*60*1000;
function credentials(env=process.env){return {user:String(env.CRM_ADMIN_USER||'').trim(),password:String(env.CRM_ADMIN_PASSWORD||'')}}
function login(user,password,env=process.env){const c=credentials(env);if(!c.user||!c.password||user!==c.user||password!==c.password)throw new Error('INVALID_CREDENTIALS');const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{user,expiresAt:Date.now()+TTL_MS});return{token,expiresIn:TTL_MS/1000,user}}
function authenticate(token){const s=sessions.get(String(token||''));if(!s)return null;if(s.expiresAt<Date.now()){sessions.delete(String(token));return null}return s}
function logout(token){sessions.delete(String(token||''))}
function configured(env=process.env){const c=credentials(env);return Boolean(c.user&&c.password)}
module.exports={login,authenticate,logout,configured};
