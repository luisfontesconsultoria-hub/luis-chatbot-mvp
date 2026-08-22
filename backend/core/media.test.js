const { normalizeMediaMessage } = require('./media');

const audio = normalizeMediaMessage({ audio:{ id:'audio-1', mime_type:'audio/ogg' } });
if (audio.type !== 'audio' || audio.mediaId !== 'audio-1') throw Error('audio normalization failed');
const text = normalizeMediaMessage({ text:{ body:'Olá' } });
if (text.type !== 'text' || text.text !== 'Olá') throw Error('text normalization failed');
const unsupported = normalizeMediaMessage({ sticker:{ id:'s-1' } });
if (unsupported.type !== 'unsupported') throw Error('unsupported media handling failed');
console.log('PASS media normalization');
