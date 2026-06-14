/** Utilitários HTTP compartilhados pelos extratores. */

export const REQUEST_TIMEOUT_MS = 20000;

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function fetchWithTimeout(url, options = {}) {
  return fetch(url, {
    redirect: 'follow',
    ...options,
    signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
  });
}
