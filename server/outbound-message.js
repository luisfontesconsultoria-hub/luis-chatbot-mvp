function createOutboundMessageHandler({ repository, sender }) {
  if (!repository || !sender) throw new Error('OUTBOUND_DEPENDENCIES_REQUIRED');
  return async function send({ lead, text, externalMessageId = null }) {
    if (!lead?.phone) throw new Error('LEAD_PHONE_REQUIRED');
    if (!text) throw new Error('OUTBOUND_TEXT_REQUIRED');
    const response = await sender.sendText({ to: lead.phone, text });
    const providerMessageId = response?.messages?.[0]?.id || externalMessageId || null;
    const saved = await repository.createMessage({
      lead_id: lead.id,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      external_message_id: providerMessageId,
      text_content: text,
      metadata: { provider: sender.provider || 'META_WHATSAPP' }
    });
    if (typeof repository.createEvent === 'function') {
      await repository.createEvent({
        lead_id: lead.id,
        type: 'WHATSAPP_RESPONSE_SENT',
        idempotency_key: providerMessageId ? `WHATSAPP_RESPONSE_SENT:${providerMessageId}` : null,
        payload: { external_message_id: providerMessageId, provider: sender.provider || 'META_WHATSAPP' }
      });
    }
    return { sent:true, response, saved };
  };
}
module.exports={createOutboundMessageHandler};
