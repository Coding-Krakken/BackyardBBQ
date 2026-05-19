import Redis from "ioredis";

export type WebhookSharedStateBackendName = "memory" | "redis";

export type WebhookSharedStateHealth = {
  backend: WebhookSharedStateBackendName;
  fallbackActive: boolean;
  redisConnected: boolean | null;
};

type DuplicateInput = {
  eventId: string;
  ttlMs: number;
  now: number;
};

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

type SharedStateBackend = {
  name: WebhookSharedStateBackendName;
  checkDuplicate: (input: DuplicateInput) => Promise<boolean>;
  isRateLimited: (input: RateLimitInput) => Promise<boolean>;
  health: () => Promise<WebhookSharedStateHealth>;
  close: () => Promise<void>;
};

type RedisLike = {
  set: (key: string, value: string, mode: "PX", ttlMs: number, condition: "NX") => Promise<"OK" | null>;
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, ttlMs: number) => Promise<number>;
  ping: () => Promise<string>;
  quit: () => Promise<"OK">;
};

class InMemorySharedStateBackend implements SharedStateBackend {
  readonly name: WebhookSharedStateBackendName = "memory";
  private readonly processedEvents = new Map<string, number>();
  private readonly rateLimitStore = new Map<string, { count: number; resetAt: number }>();

  async checkDuplicate(input: DuplicateInput) {
    const { eventId, ttlMs, now } = input;

    for (const [storedEventId, storedAt] of this.processedEvents) {
      if (now - storedAt > ttlMs) {
        this.processedEvents.delete(storedEventId);
      }
    }

    const existing = this.processedEvents.get(eventId);
    if (typeof existing === "number" && now - existing <= ttlMs) {
      return true;
    }

    this.processedEvents.set(eventId, now);
    return false;
  }

  async isRateLimited(input: RateLimitInput) {
    const { key, limit, windowMs } = input;
    const now = Date.now();
    const current = this.rateLimitStore.get(key);

    if (!current || current.resetAt <= now) {
      this.rateLimitStore.set(key, {
        count: 1,
        resetAt: now + windowMs
      });
      return false;
    }

    if (current.count >= limit) {
      return true;
    }

    current.count += 1;
    this.rateLimitStore.set(key, current);
    return false;
  }

  async health() {
    return {
      backend: "memory" as const,
      fallbackActive: false,
      redisConnected: null
    };
  }

  async close() {
    this.processedEvents.clear();
    this.rateLimitStore.clear();
  }
}

class RedisSharedStateBackend implements SharedStateBackend {
  readonly name: WebhookSharedStateBackendName = "redis";

  constructor(private readonly redis: RedisLike) {}

  async checkDuplicate(input: DuplicateInput) {
    const key = `bbq:webhook:dedupe:${input.eventId}`;
    const result = await this.redis.set(key, "1", "PX", input.ttlMs, "NX");
    return result !== "OK";
  }

  async isRateLimited(input: RateLimitInput) {
    const key = `bbq:webhook:rate:${input.key}`;
    const nextCount = await this.redis.incr(key);
    if (nextCount === 1) {
      await this.redis.pexpire(key, input.windowMs);
    }

    return nextCount > input.limit;
  }

  async health() {
    try {
      await this.redis.ping();
      return {
        backend: "redis" as const,
        fallbackActive: false,
        redisConnected: true
      };
    } catch {
      return {
        backend: "redis" as const,
        fallbackActive: false,
        redisConnected: false
      };
    }
  }

  async close() {
    await this.redis.quit();
  }
}

type WebhookSharedStateOptions = {
  redisUrl?: string;
  backendMode?: string;
  onFallbackError?: (input: { op: "duplicate" | "rateLimit"; error: unknown }) => void;
  redisClient?: RedisLike;
};

export class WebhookSharedState {
  private readonly fallbackBackend = new InMemorySharedStateBackend();
  private readonly primaryBackend: SharedStateBackend;

  constructor(private readonly options: WebhookSharedStateOptions = {}) {
    this.primaryBackend = this.resolvePrimaryBackend(options);
  }

  get backendName() {
    return this.primaryBackend.name;
  }

  async checkDuplicate(eventId: string, ttlMs: number, now = Date.now()) {
    try {
      return await this.primaryBackend.checkDuplicate({ eventId, ttlMs, now });
    } catch (error) {
      this.options.onFallbackError?.({ op: "duplicate", error });
      return this.fallbackBackend.checkDuplicate({ eventId, ttlMs, now });
    }
  }

  async isRateLimited(key: string, limit: number, windowMs: number) {
    try {
      return await this.primaryBackend.isRateLimited({ key, limit, windowMs });
    } catch (error) {
      this.options.onFallbackError?.({ op: "rateLimit", error });
      return this.fallbackBackend.isRateLimited({ key, limit, windowMs });
    }
  }

  async health() {
    const primary = await this.primaryBackend.health();
    if (this.primaryBackend.name === "memory") {
      return primary;
    }

    if (primary.redisConnected) {
      return primary;
    }

    return {
      ...primary,
      fallbackActive: true
    };
  }

  async close() {
    await Promise.allSettled([this.primaryBackend.close(), this.fallbackBackend.close()]);
  }

  private resolvePrimaryBackend(options: WebhookSharedStateOptions): SharedStateBackend {
    const mode = (options.backendMode ?? process.env.WEBHOOK_STATE_BACKEND ?? "auto").toLowerCase();
    const redisUrl = options.redisUrl ?? process.env.REDIS_URL;
    const hasRedisClient = Boolean(options.redisClient);

    if (mode === "memory") {
      return new InMemorySharedStateBackend();
    }

    if ((mode === "redis" || mode === "auto") && (redisUrl || hasRedisClient)) {
      const client = options.redisClient ?? new Redis(redisUrl as string, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false
      });
      return new RedisSharedStateBackend(client);
    }

    return new InMemorySharedStateBackend();
  }
}

export function createWebhookSharedState(options?: WebhookSharedStateOptions) {
  return new WebhookSharedState(options);
}
