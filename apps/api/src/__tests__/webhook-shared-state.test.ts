import { WebhookSharedState } from "../webhook/shared-state";
import { createWebhookSharedState } from "../webhook/shared-state";

class MockRedis {
  private readonly kv = new Map<string, string>();
  private readonly expiryByKey = new Map<string, number>();

  constructor(private readonly shouldFail = false) {}

  private isExpired(key: string) {
    const expiresAt = this.expiryByKey.get(key);
    if (typeof expiresAt !== "number") {
      return false;
    }

    if (Date.now() <= expiresAt) {
      return false;
    }

    this.kv.delete(key);
    this.expiryByKey.delete(key);
    return true;
  }

  async set(key: string, value: string, _mode: "PX", ttlMs: number, _condition: "NX") {
    if (this.shouldFail) {
      throw new Error("redis unavailable");
    }

    this.isExpired(key);
    if (this.kv.has(key)) {
      return null;
    }

    this.kv.set(key, value);
    this.expiryByKey.set(key, Date.now() + ttlMs);
    return "OK" as const;
  }

  async incr(key: string) {
    if (this.shouldFail) {
      throw new Error("redis unavailable");
    }

    this.isExpired(key);
    const current = Number(this.kv.get(key) ?? "0");
    const next = current + 1;
    this.kv.set(key, String(next));
    return next;
  }

  async pexpire(key: string, ttlMs: number) {
    if (this.shouldFail) {
      throw new Error("redis unavailable");
    }

    this.expiryByKey.set(key, Date.now() + ttlMs);
    return 1;
  }

  async ping() {
    if (this.shouldFail) {
      throw new Error("redis unavailable");
    }

    return "PONG";
  }

  async quit() {
    return "OK" as const;
  }
}

class MockRedisQuitFailure extends MockRedis {
  async quit(): Promise<"OK"> {
    throw new Error("quit failed");
  }
}

describe("WebhookSharedState", () => {
  it("uses in-memory backend when mode is explicitly memory", async () => {
    const state = new WebhookSharedState({ backendMode: "memory" });

    expect(state.backendName).toBe("memory");
    expect(await state.checkDuplicate("evt_memory", 60_000, 1_000)).toBe(false);
    expect(await state.checkDuplicate("evt_memory", 60_000, 1_100)).toBe(true);
    expect(await state.health()).toEqual({
      backend: "memory",
      fallbackActive: false,
      redisConnected: null
    });

    await state.close();
  });

  it("falls back to memory backend when redis mode has no redis config", async () => {
    const state = new WebhookSharedState({ backendMode: "redis" });

    expect(state.backendName).toBe("memory");
    expect(await state.checkDuplicate("evt_no_redis", 60_000, 5_000)).toBe(false);

    await state.close();
  });

  it("uses redis backend in auto mode when redis client is provided", async () => {
    const state = new WebhookSharedState({ redisClient: new MockRedis() });

    expect(state.backendName).toBe("redis");
    expect(await state.checkDuplicate("evt_auto_mode", 60_000)).toBe(false);

    await state.close();
  });

  it("evicts stale duplicate markers in memory backend", async () => {
    const state = new WebhookSharedState({ backendMode: "memory" });

    expect(await state.checkDuplicate("evt_old", 100, 1_000)).toBe(false);
    expect(await state.checkDuplicate("evt_fresh", 100, 1_250)).toBe(false);
    expect(await state.checkDuplicate("evt_old", 100, 1_260)).toBe(false);

    await state.close();
  });

  it("creates state through factory helper", async () => {
    const state = createWebhookSharedState({ backendMode: "memory" });

    expect(state).toBeInstanceOf(WebhookSharedState);
    expect(await state.checkDuplicate("evt_factory", 60_000, 7_000)).toBe(false);

    await state.close();
  });

  it("resets in-memory rate limit after window expiration", async () => {
    const state = new WebhookSharedState({ backendMode: "memory" });
    const key = "198.51.100.99";

    expect(await state.isRateLimited(key, 2, 20)).toBe(false);
    expect(await state.isRateLimited(key, 2, 20)).toBe(false);
    expect(await state.isRateLimited(key, 2, 20)).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(await state.isRateLimited(key, 2, 20)).toBe(false);
    await state.close();
  });

  it("detects duplicates across three shared redis-backed instances", async () => {
    const redis = new MockRedis();

    const instances: [WebhookSharedState, WebhookSharedState, WebhookSharedState] = [
      new WebhookSharedState({ backendMode: "redis", redisClient: redis }),
      new WebhookSharedState({ backendMode: "redis", redisClient: redis }),
      new WebhookSharedState({ backendMode: "redis", redisClient: redis })
    ];

    const results = await Promise.all([
      instances[0].checkDuplicate("evt_shared", 60_000),
      instances[1].checkDuplicate("evt_shared", 60_000),
      instances[2].checkDuplicate("evt_shared", 60_000)
    ]);

    const firstSeenCount = results.filter((result) => result === false).length;
    const duplicateCount = results.filter((result) => result === true).length;

    expect(firstSeenCount).toBe(1);
    expect(duplicateCount).toBe(2);

    await Promise.all(instances.map((instance) => instance.close()));
  });

  it("enforces global rate limiting across three shared redis-backed instances", async () => {
    const redis = new MockRedis();

    const instances: [WebhookSharedState, WebhookSharedState, WebhookSharedState] = [
      new WebhookSharedState({ backendMode: "redis", redisClient: redis }),
      new WebhookSharedState({ backendMode: "redis", redisClient: redis }),
      new WebhookSharedState({ backendMode: "redis", redisClient: redis })
    ];

    const results = await Promise.all([
      instances[0].isRateLimited("203.0.113.10", 2, 60_000),
      instances[1].isRateLimited("203.0.113.10", 2, 60_000),
      instances[2].isRateLimited("203.0.113.10", 2, 60_000)
    ]);

    expect(results.filter((result) => result === true)).toHaveLength(1);
    expect(results.filter((result) => result === false)).toHaveLength(2);

    await Promise.all(instances.map((instance) => instance.close()));
  });

  it("gracefully falls back to in-memory mode when redis fails", async () => {
    const fallbackErrors: string[] = [];
    const state = new WebhookSharedState({
      backendMode: "redis",
      redisClient: new MockRedis(true),
      onFallbackError: ({ op }) => {
        fallbackErrors.push(op);
      }
    });

    expect(await state.checkDuplicate("evt_fallback", 60_000)).toBe(false);
    expect(await state.checkDuplicate("evt_fallback", 60_000)).toBe(true);

    expect(await state.isRateLimited("198.51.100.20", 1, 60_000)).toBe(false);
    expect(await state.isRateLimited("198.51.100.20", 1, 60_000)).toBe(true);

    expect(fallbackErrors).toContain("duplicate");
    expect(fallbackErrors).toContain("rateLimit");

    const health = await state.health();
    expect(health.backend).toBe("redis");
    expect(health.fallbackActive).toBe(true);
    expect(health.redisConnected).toBe(false);

    await state.close();
  });

  it("falls back without requiring fallback callback", async () => {
    const state = new WebhookSharedState({
      backendMode: "redis",
      redisClient: new MockRedis(true)
    });

    expect(await state.checkDuplicate("evt_fallback_no_callback", 60_000)).toBe(false);
    expect(await state.checkDuplicate("evt_fallback_no_callback", 60_000)).toBe(true);
    expect(await state.isRateLimited("198.51.100.30", 1, 60_000)).toBe(false);
    expect(await state.isRateLimited("198.51.100.30", 1, 60_000)).toBe(true);

    await state.close();
  });

  it("reports healthy redis backend when ping succeeds", async () => {
    const state = new WebhookSharedState({
      backendMode: "redis",
      redisClient: new MockRedis(false)
    });

    const health = await state.health();
    expect(health.backend).toBe("redis");
    expect(health.fallbackActive).toBe(false);
    expect(health.redisConnected).toBe(true);

    await state.close();
  });

  it("does not throw when close encounters backend failures", async () => {
    const state = new WebhookSharedState({
      backendMode: "redis",
      redisClient: new MockRedisQuitFailure()
    });

    await expect(state.close()).resolves.toBeUndefined();
  });
});
