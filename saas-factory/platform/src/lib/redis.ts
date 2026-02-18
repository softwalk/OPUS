import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const url = process.env.REDIS_URL || "redis://localhost:6379";
  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy(times) {
      if (times > 3) {
        console.warn("[Redis] Connection failed after 3 retries. Redis features disabled.");
        return null; // stop retrying
      }
      return Math.min(times * 200, 2000);
    },
  });

  client.on("error", (err) => {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Redis] Connection error (non-fatal in dev):", err.message);
    }
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

export default redis;
