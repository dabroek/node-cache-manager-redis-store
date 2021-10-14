import { Store } from "cache-manager";
import { RedisClient } from "redis";

interface RedisStore extends Store {
  getClient: () => RedisClient;
}

export default RedisStore;
