type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitRecord>();

export function checkRateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
}) {
  const now = input.now ?? Date.now();
  const existing = store.get(input.key);

  if (!existing || existing.resetAt <= now) {
    store.set(input.key, {
      count: 1,
      resetAt: now + input.windowMs,
    });

    return {
      allowed: true,
      remaining: Math.max(0, input.limit - 1),
      resetAt: now + input.windowMs,
    };
  }

  if (existing.count >= input.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  store.set(input.key, existing);

  return {
    allowed: true,
    remaining: Math.max(0, input.limit - existing.count),
    resetAt: existing.resetAt,
  };
}

export function clearRateLimitStore() {
  store.clear();
}
