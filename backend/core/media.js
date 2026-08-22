/** Normalize inbound WhatsApp media without coupling the SDR to a provider. */
function normalizeMediaMessage(message = {}) {
  if (message.text?.body) return { type: 'text', text: message.text.body };
  if (message.audio?.id) return { type: 'audio', mediaId: message.audio.id, mimeType: message.audio.mime_type || null };
  if (message.image?.id) return { type: 'image', mediaId: message.image.id, caption: message.image.caption || '' };
  if (message.document?.id) return { type: 'document', mediaId: message.document.id, filename: message.document.filename || null };
  return { type: 'unsupported' };
}

async function transcribeAudio({ media, transcriber }) {
  if (!media || media.type !== 'audio') throw new Error('audio_required');
  if (!transcriber || typeof transcriber.transcribe !== 'function') throw new Error('transcriber_not_configured');
  return transcriber.transcribe(media);
}

module.exports = { normalizeMediaMessage, transcribeAudio };
