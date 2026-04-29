const assert = require("assert");
const Redis = require("ioredis");

const redis = new Redis({
  host: process.env.REDIS_HOST || "localhost",
  port: 6379,
});

describe("Redis Integration", () => {
  after(() => redis.quit());

  it("should connect and set/get a value", async () => {
    await redis.set("test-key", "hello-ci");
    const value = await redis.get("test-key");
    assert.strictEqual(value, "hello-ci");
  });

  it("should increment a counter", async () => {
    await redis.del("counter");
    await redis.incr("counter");
    await redis.incr("counter");
    const count = await redis.get("counter");
    assert.strictEqual(count, "2");
  });

  it("should handle list operations", async () => {
    await redis.del("test-messages");
    await redis.lpush("test-messages", JSON.stringify({ text: "hello" }));
    const msgs = await redis.lrange("test-messages", 0, -1);
    assert.strictEqual(msgs.length, 1);
    assert.strictEqual(JSON.parse(msgs[0]).text, "hello");
  });
});
