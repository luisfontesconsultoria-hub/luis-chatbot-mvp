function createOutboundMessageHandler({ repository, sender }) {
  if (!repository || !sender) throw new Error('OUTBOUND_DEPENDENCIES_REQUIRED');
  return async function send({ lead, text, externalMessageId = null }) {
    if (!lead?.phone) throw new Error('LEAD_PHONE_REQUIRED');
    if (!text) throw new Error('OUTBOUND_TEXT_REQUIRED');
    const response = await sender.sendText({ to: lead.phone, text });
    const saved = await repository.createMessage({
      lead_id: lead.id,
      channel: 'WHATSAPP',
      direction: 'OUTBOUND',
      external_message_id: response?.messages?.[0]?.id || externalMessageId,
      phone: lead.phone,
      type: 'text',
      text,
      source: 'WHATSAPP'
    });
    if (typeof repository.createEvent === 'function') {
      await repository.createEvent({ lead_id: lead.id, event_type:'WHATSAPP_RESPONSE_SENT', metadata:{ external_message_id: saved?.external_message_id || null } });
    }
    return { sent:true, response, saved };
  };
}
module.exports={createOutboundMessageHandler};
