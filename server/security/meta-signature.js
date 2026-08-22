const crypto = require('crypto');
function verifyMetaSignature(rawBody, signatureHeader, appSecret) {
  if (!rawBody || !signatureHeader || !appSecret) return false;
  const provided = String(signatureHeader).replace(/^sha256=/, '');
  const expected = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const a=Buffer.from(provided,'hex'); const b=Buffer.from(expected,'hex');
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
module.exports={verifyMetaSignature};
