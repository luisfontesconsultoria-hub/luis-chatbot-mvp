// Fila durável (spool) de mensagens WhatsApp que chegaram mas não puderam ser
// gravadas no CRM (ex.: Supabase fora do ar). Guarda só o payload normalizado
// da mensagem (nunca credenciais) em JSONL no disco persistente, e reprocessa
// depois pelo mesmo pipeline idempotente. Após maxAttempts vai para dead-letter.
const fs = require('fs');
const path = require('path');

function keyOf(message = {}) {
  return message.external_message_id || `${message.phone || message.whatsapp_jid || 'unknown'}:${message.timestamp || ''}:${message.text || ''}`;
}

function createInboundSpool({ dir, name = 'inbound', maxEntries = 5000, maxAttempts = 30, now = () => Date.now() } = {}) {
  if (!dir) throw new Error('SPOOL_DIR_REQUIRED');
  const file = path.join(dir, `${name}.jsonl`);
  const deadFile = path.join(dir, `${name}.dead.jsonl`);
  let replaying = false;

  function ensureDir() { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
  function read() {
    try {
      return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => { try { return JSON.parse(line); } catch (_) { return null; } }).filter(Boolean);
    } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  }
  function write(entries) {
    ensureDir();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, entries.map(e => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
  function appendDead(entry) {
    ensureDir();
    fs.appendFileSync(deadFile, JSON.stringify(entry) + '\n', { mode: 0o600 });
  }

  function enqueue(message, error = null) {
    const entries = read();
    const key = keyOf(message);
    if (entries.some(e => e.key === key)) return { queued: false, reason: 'ALREADY_QUEUED', size: entries.length };
    if (entries.length >= maxEntries) { appendDead({ key, message, attempts: 0, reason: 'SPOOL_FULL', at: new Date(now()).toISOString() }); return { queued: false, reason: 'SPOOL_FULL', size: entries.length }; }
    entries.push({ key, message, attempts: 0, firstSeenAt: new Date(now()).toISOString(), lastError: error ? String(error).slice(0, 200) : null });
    write(entries);
    return { queued: true, size: entries.length };
  }

  function size() { return read().length; }

  // processFn(message, entry) -> 'done' | 'retry' (lança = retry)
  async function replay(processFn) {
    if (replaying) return { skipped: true };
    replaying = true;
    const summary = { done: 0, retry: 0, dead: 0 };
    try {
      const entries = read();
      if (!entries.length) return summary;
      const keep = [];
      for (const entry of entries) {
        let outcome = 'retry', err = null;
        try { outcome = await processFn(entry.message, entry); } catch (e) { err = e?.message || String(e); }
        if (outcome === 'done') { summary.done++; continue; }
        entry.attempts = (entry.attempts || 0) + 1;
        entry.lastError = (err || entry.lastError || 'RETRY').slice(0, 200);
        if (entry.attempts >= maxAttempts) { appendDead({ ...entry, reason: 'MAX_ATTEMPTS', at: new Date(now()).toISOString() }); summary.dead++; continue; }
        keep.push(entry); summary.retry++;
      }
      // mensagens que chegaram durante o replay foram gravadas no arquivo; preserva-as
      const processed = new Set(entries.map(e => e.key));
      const arrived = read().filter(e => !processed.has(e.key));
      write([...keep, ...arrived]);
      return summary;
    } finally { replaying = false; }
  }

  return { enqueue, replay, size, file, deadFile };
}

module.exports = { createInboundSpool, keyOf };
