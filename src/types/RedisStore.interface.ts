import {Store} from "cache-manager";
import {RedisClientType, RedisDefaultModules, RedisFunctions, RedisModules, RedisScripts} from "redis";

export interface RedisStore extends Store {
    isCacheableValue: (value: unknown) => boolean;
    getClient(): RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts>;
}
