const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const retryAfterMs = (error) => {
  const value = error?.retryAfter;
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - Date.now());
};

export const withRetry = async (
  operation,
  {
    retries = 3,
    baseDelayMs = 300,
    shouldRetry = () => false,
    onRetry = () => {},
  } = {},
) => {
  let attempt = 0;

  while (true) {
    try {
      return await operation(attempt);
    } catch (error) {
      if (attempt >= retries || !shouldRetry(error)) throw error;

      const delay =
        retryAfterMs(error) ??
        baseDelayMs * 2 ** attempt + Math.floor(Math.random() * 100);
      attempt += 1;
      onRetry(error, attempt, delay);
      await sleep(delay);
    }
  }
};
