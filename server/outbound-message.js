function createOutboundMessageHandler({ repository, sender }) {
  if (!repository || !sender) throw new Error('OUTBOUND_DEPENDENCIES_REQUIRED');
  return async function send({ lead, text, externalMessageId = null }) {
    const jid=lead?.whatsappJid||lead?.whatsapp_jid||null;
    if (!lead?.phone && !jid) throw new Error('LEAD_WHATSAPP_IDENTITY_REQUIRED');
    if (!text) throw new Error('OUTBOUND_TEXT_REQUIRED');
    const response = await sender.sendText({ to: lead.phone||null, jid, text });
    const providerMessageId = response?.messages?.[0]?.id || externalMessageId || null;
    const saved = await repository.createMessage({
      lead_id: lead.id,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      external_message_id: providerMessageId,
      text_content: text,
      metadata: { provider: sender.provider || 'META_WHATSAPP', whatsapp_jid: jid }
    });
    if (typeof repository.createEvent === 'function') {
      await repository.createEvent({
        lead_id: lead.id,
        type: 'WHATSAPP_RESPONSE_SENT',
        idempotency_key: providerMessageId ? `WHATSAPP_RESPONSE_SENT:${providerMessageId}` : null,
        payload: { external_message_id: providerMessageId, provider: sender.provider || 'META_WHATSAPP', whatsapp_jid: jid }
      });
    }
    return { sent:true, response, saved };
  };
}
module.exports={createOutboundMessageHandler};
