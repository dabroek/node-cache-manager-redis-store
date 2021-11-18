import type { Store } from "cache-manager";
import type { RedisClient } from "redis";

declare namespace redisStore {
  function create(...args: unknown[]): {
    getClient: () => RedisClient;
  } & Store;
}

export default redisStore;
