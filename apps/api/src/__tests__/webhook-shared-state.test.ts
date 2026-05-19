import { WebhookSharedState } from "../webhook/shared-state";

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

describe("WebhookSharedState", () => {
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
});
