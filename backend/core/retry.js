/** Bounded retry with exponential backoff. No infinite loops. */
async function withRetry(fn, { attempts = 3, baseMs = 250, shouldRetry = () => true } = {}) {
  let lastError;
  for (let i = 1; i <= attempts; i += 1) {
    try { return await fn(i); }
    catch (error) {
      lastError = error;
      if (i === attempts || !shouldRetry(error)) throw error;
      await new Promise(resolve => setTimeout(resolve, baseMs * (2 ** (i - 1))));
    }
  }
  throw lastError;
}
module.exports = { withRetry };
