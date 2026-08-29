import "server-only";

/**
 * Limitation de débit par clé API.
 *
 * Une clé qui fuite, ou une boucle mal écrite chez un client, martelait la
 * base — celle de tous les autres clients. Fenêtre glissante en mémoire :
 * suffisant pour une instance, à remplacer par Redis le jour où l'app tourne
 * sur plusieurs machines. C'est écrit ici pour qu'on s'en souvienne.
 */

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

type Window = { count: number; resetAt: number };
const windows = new Map<string, Window>();

/** Empêche la table de grossir indéfiniment sur une instance longue durée. */
function sweep(now: number) {
  if (windows.size < 5000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const window = windows.get(key);

  if (!window || window.resetAt <= now) {
    const resetAt = now + WINDOW_MS;
    windows.set(key, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: MAX_REQUESTS - 1,
      resetAt,
      retryAfterSeconds: 0,
    };
  }

  window.count += 1;
  const remaining = Math.max(MAX_REQUESTS - window.count, 0);

  return {
    allowed: window.count <= MAX_REQUESTS,
    remaining,
    resetAt: window.resetAt,
    retryAfterSeconds: Math.ceil((window.resetAt - now) / 1000),
  };
}

/** En-têtes standards, pour que l'appelant puisse s'auto-réguler. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(MAX_REQUESTS),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
    ...(result.allowed ? {} : { "Retry-After": String(result.retryAfterSeconds) }),
  };
}

export { MAX_REQUESTS as RATE_LIMIT_PER_MINUTE };
