/** Hard gate: only the configured V1 WhatsApp number may operate during pilot. */
function assertSingleNumberPilot(event, allowedPhoneNumberId) {
  if (!allowedPhoneNumberId) throw new Error('V1_ALLOWED_PHONE_NUMBER_ID_NOT_CONFIGURED');
  const received = event?.metadata?.phoneNumberId;
  if (!received || received !== allowedPhoneNumberId) throw new Error('V1_NUMBER_NOT_AUTHORIZED');
  return true;
}
module.exports = { assertSingleNumberPilot };
