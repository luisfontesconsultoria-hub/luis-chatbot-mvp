const { withRetry } = require('./retry');

(async () => {
  let attempts = 0;
  const value = await withRetry(async () => { attempts += 1; if (attempts < 3) throw Error('temporary'); return 'ok'; }, { attempts: 3, baseMs: 1 });
  if (value !== 'ok' || attempts !== 3) throw Error('retry recovery failed');

  let stopped = 0;
  let failed = false;
  try { await withRetry(async () => { stopped += 1; throw Error('permanent'); }, { attempts: 3, baseMs: 1, shouldRetry: () => false }); } catch { failed = true; }
  if (!failed || stopped !== 1) throw Error('non-retryable error was retried');
  console.log('PASS bounded retry');
})();
