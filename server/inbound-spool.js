// Fila durável (spool) de mensagens WhatsApp que chegaram mas não puderam ser
// gravadas no CRM (ex.: Supabase fora do ar). Guarda só o payload normalizado
// da mensagem (nunca credenciais) em JSONL no disco persistente e reprocessa
// depois pelo pipeline idempotente.
//
// Política:
// - Erro transitório (banco/rede fora): NÃO conta para dead-letter. Fica na fila
//   até maxAgeMs (padrão 7 dias), com espera crescente por mensagem e parada do
//   lote no primeiro erro transitório (circuit breaker: não martela o banco).
// - Erro não transitório (dado inválido, bug): dead-letter após maxAttempts.
// - Linha corrompida no arquivo: vai para o dead-letter com o conteúdo bruto
//   (nunca é descartada em silêncio).
// - requeueDead(): devolve o dead-letter para a fila (reprocesso manual).
const fs = require('fs');
const path = require('path');

const TRANSIENT_ERROR = /fetch failed|timeout|timed out|ECONN|ENOTFOUND|EAI_AGAIN|EHOSTUNREACH|ETIMEDOUT|socket|network|unavailable|rate limit|\b429\b|\b50[0-4]\b|\b52\d\b|\b540\b|PGRST00\d|too many connections/i;

function keyOf(message = {}) {
  return message.external_message_id || `${message.phone || message.whatsapp_jid || 'unknown'}:${message.timestamp || ''}:${message.text || ''}`;
}
function isTransientError(error) { return TRANSIENT_ERROR.test(String(error || '')); }
function backoffMs(attempts, baseMs = 60000, maxMs = 30 * 60000) { return Math.min(baseMs * Math.pow(2, Math.max(0, attempts - 1)), maxMs); }

function createInboundSpool({ dir, name = 'inbound', maxEntries = 5000, maxAttempts = 10, maxAgeMs = 7 * 24 * 60 * 60 * 1000, baseBackoffMs = 60000, maxBackoffMs = 30 * 60000, now = () => Date.now() } = {}) {
  if (!dir) throw new Error('SPOOL_DIR_REQUIRED');
  const file = path.join(dir, `${name}.jsonl`);
  const deadFile = path.join(dir, `${name}.dead.jsonl`);
  let replaying = false;

  function ensureDir() { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); }
  function parseLines(raw) {
    const ok = [], bad = [];
    for (const line of raw.split('\n')) { if (!line.trim()) continue; try { ok.push(JSON.parse(line)); } catch (_) { bad.push(line); } }
    return { ok, bad };
  }
  function readRaw(f) { try { return fs.readFileSync(f, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return ''; throw e; } }
  function read() {
    const { ok, bad } = parseLines(readRaw(file));
    if (bad.length) { for (const raw of bad) appendDead({ raw, reason: 'CORRUPTED_LINE', at: new Date(now()).toISOString() }); write(ok); }
    return ok;
  }
  function write(entries) {
    ensureDir();
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, entries.map(e => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : ''), { mode: 0o600 });
    fs.renameSync(tmp, file);
  }
  function appendDead(entry) { ensureDir(); fs.appendFileSync(deadFile, JSON.stringify(entry) + '\n', { mode: 0o600 }); }

  function enqueue(message, error = null) {
    const entries = read();
    const key = keyOf(message);
    if (entries.some(e => e.key === key)) return { queued: false, reason: 'ALREADY_QUEUED', size: entries.length };
    const at = new Date(now()).toISOString();
    if (entries.length >= maxEntries) { appendDead({ key, message, attempts: 0, reason: 'SPOOL_FULL', at }); return { queued: false, reason: 'SPOOL_FULL', size: entries.length }; }
    entries.push({ key, message, attempts: 0, firstSeenAt: at, nextAttemptAt: new Date(now() + baseBackoffMs).toISOString(), lastError: error ? String(error).slice(0, 200) : null });
    write(entries);
    return { queued: true, size: entries.length };
  }

  function size() { return read().length; }
  function deadSize() { return parseLines(readRaw(deadFile)).ok.length; }

  // processFn(message, entry) -> 'done' (lança = falha)
  async function replay(processFn, { force = false } = {}) {
    if (replaying) return { skipped: true };
    replaying = true;
    const summary = { done: 0, retry: 0, dead: 0, deferred: 0, halted: false };
    try {
      const entries = read();
      if (!entries.length) return summary;
      const keep = [];
      const t = now();
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (summary.halted) { keep.push(entry); summary.deferred++; continue; }
        const age = t - (Date.parse(entry.firstSeenAt) || t);
        if (age > maxAgeMs) { appendDead({ ...entry, reason: 'MAX_AGE', at: new Date(t).toISOString() }); summary.dead++; continue; }
        if (!force && entry.nextAttemptAt && Date.parse(entry.nextAttemptAt) > t) { keep.push(entry); summary.deferred++; continue; }
        let err = null;
        try { const outcome = await processFn(entry.message, entry); if (outcome === 'done') { summary.done++; continue; } err = 'RETRY'; }
        catch (e) { err = e?.message || String(e); }
        entry.attempts = (entry.attempts || 0) + 1;
        entry.lastError = String(err).slice(0, 200);
        entry.nextAttemptAt = new Date(t + backoffMs(entry.attempts, baseBackoffMs, maxBackoffMs)).toISOString();
        const transient = isTransientError(err);
        if (!transient && entry.attempts >= maxAttempts) { appendDead({ ...entry, reason: 'MAX_ATTEMPTS', at: new Date(t).toISOString() }); summary.dead++; continue; }
        keep.push(entry); summary.retry++;
        if (transient) summary.halted = true; // banco/rede fora: para o lote, tenta de novo depois
      }
      // mensagens que chegaram durante o replay foram gravadas no arquivo; preserva-as
      const processed = new Set(entries.map(e => e.key));
      const arrived = read().filter(e => !processed.has(e.key));
      write([...keep, ...arrived]);
      return summary;
    } finally { replaying = false; }
  }

  function requeueDead() {
    const { ok } = parseLines(readRaw(deadFile));
    const entries = read(); const keys = new Set(entries.map(e => e.key));
    let requeued = 0, skipped = 0;
    for (const d of ok) {
      if (!d.message || keys.has(d.key)) { skipped++; continue; }
      entries.push({ key: d.key, message: d.message, attempts: 0, firstSeenAt: new Date(now()).toISOString(), nextAttemptAt: null, lastError: `REQUEUED_FROM_DEAD:${d.reason || ''}` });
      keys.add(d.key); requeued++;
    }
    write(entries);
    ensureDir(); const remaining = ok.filter(d => !d.message); fs.writeFileSync(deadFile, remaining.map(d => JSON.stringify(d)).join('\n') + (remaining.length ? '\n' : ''), { mode: 0o600 });
    return { requeued, skipped };
  }

  return { enqueue, replay, size, deadSize, requeueDead, file, deadFile };
}

module.exports = { createInboundSpool, keyOf, isTransientError, backoffMs };
