import "server-only";

interface RateLimitStore {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, RateLimitStore>();

// Limpeza periódica de chaves expiradas para evitar vazamento de memória
if (process.env.NODE_ENV !== "test") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, store] of memoryStore.entries()) {
      if (store.resetAt <= now) {
        memoryStore.delete(key);
      }
    }
  }, 60_000);
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

export function checkRateLimit(identifier: string, options: RateLimitOptions) {
  const { windowMs, max, keyPrefix = "rl" } = options;
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();

  const record = memoryStore.get(key);

  if (!record || record.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: max - 1,
      resetAt: now + windowMs,
    };
  }

  if (record.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: record.resetAt,
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: max - record.count,
    resetAt: record.resetAt,
  };
}

export function clearRateLimits() {
  memoryStore.clear();
}
