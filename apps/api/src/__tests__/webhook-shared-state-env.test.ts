/** @jest-environment node */

describe("WebhookSharedState env-based backend resolution", () => {
  const originalRedisUrl = process.env.REDIS_URL;
  const originalBackendMode = process.env.WEBHOOK_STATE_BACKEND;

  afterEach(() => {
    jest.resetModules();
    jest.unmock("ioredis");

    if (typeof originalRedisUrl === "string") {
      process.env.REDIS_URL = originalRedisUrl;
    } else {
      delete process.env.REDIS_URL;
    }

    if (typeof originalBackendMode === "string") {
      process.env.WEBHOOK_STATE_BACKEND = originalBackendMode;
    } else {
      delete process.env.WEBHOOK_STATE_BACKEND;
    }
  });

  it("creates redis backend from env when constructed without options", async () => {
    const redisSet = jest.fn(async () => "OK" as const);
    const redisIncr = jest.fn(async () => 1);
    const redisPexpire = jest.fn(async () => 1);
    const redisPing = jest.fn(async () => "PONG");
    const redisQuit = jest.fn(async () => "OK" as const);

    const RedisMock = jest.fn().mockImplementation(() => ({
      set: redisSet,
      incr: redisIncr,
      pexpire: redisPexpire,
      ping: redisPing,
      quit: redisQuit,
    }));

    jest.doMock("ioredis", () => ({
      __esModule: true,
      default: RedisMock,
    }));

    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    process.env.WEBHOOK_STATE_BACKEND = "auto";

    const { WebhookSharedState } = await import("../webhook/shared-state");
    const state = new WebhookSharedState();

    expect(state.backendName).toBe("redis");
    expect(RedisMock).toHaveBeenCalledWith("redis://127.0.0.1:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    await expect(state.close()).resolves.toBeUndefined();
    expect(redisQuit).toHaveBeenCalledTimes(1);
  });

  it("prefers explicit redisUrl option over environment value", async () => {
    const redisQuit = jest.fn(async () => "OK" as const);
    const RedisMock = jest.fn().mockImplementation(() => ({
      set: jest.fn(async () => "OK" as const),
      incr: jest.fn(async () => 1),
      pexpire: jest.fn(async () => 1),
      ping: jest.fn(async () => "PONG"),
      quit: redisQuit,
    }));

    jest.doMock("ioredis", () => ({
      __esModule: true,
      default: RedisMock,
    }));

    process.env.REDIS_URL = "redis://env-host:6379";

    const { WebhookSharedState } = await import("../webhook/shared-state");
    const state = new WebhookSharedState({
      backendMode: "redis",
      redisUrl: "redis://option-host:6379",
    });

    expect(state.backendName).toBe("redis");
    expect(RedisMock).toHaveBeenCalledWith("redis://option-host:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    await expect(state.close()).resolves.toBeUndefined();
    expect(redisQuit).toHaveBeenCalledTimes(1);
  });
});
