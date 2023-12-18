import {Store} from "cache-manager";
import {RedisClientType, RedisDefaultModules, RedisFunctions, RedisModules, RedisScripts} from "redis";
import {ScanReply} from '@redis/client/dist/lib/commands/SCAN';

export interface RedisStore extends Store {
  isCacheableValue: (value: unknown) => boolean;

  getClient(): RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts>;

  scan(pattern: string): Promise<ScanReply>;
}
