import {
  createClient,
  RedisClientType,
  RedisDefaultModules,
  RedisFunctions,
  RedisModules, RedisScripts
} from 'redis';
import {Milliseconds, RedisStore, TConfig, TMset} from './types';
import {ScanReply} from '@redis/client/dist/lib/commands/SCAN';

export const redisStore = async (config?: TConfig): Promise<RedisStore> => {
  const redisCache: RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts> = createClient(config);
  await redisCache.connect();

  return new buildRedisStoreWithConfig(redisCache, config);
}

class buildRedisStoreWithConfig implements RedisStore {
  private readonly redisCache: RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts>;
  private readonly config: TConfig | undefined
  isCacheableValue: (value: unknown) => boolean;

  constructor(redisCache: RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts>, config?: TConfig) {
    this.redisCache = redisCache;
    this.config = config;
    this.isCacheableValue = config?.isCacheable || this.localIsCacheable;
  }

  public async set<T>(key: string, value: T | string, ttl?: Milliseconds): Promise<void> {
    if (!this.isCacheableValue(value)) {
      throw new Error(`"${value}" is not a cacheable value`);
    }

    const ttlValue = this.getTtl(ttl);
    if (ttlValue) {
      await this.redisCache.set(key, this.encodeValue(value), {PX: ttlValue});
    } else {
      await this.redisCache.set(key, this.encodeValue(value));
    }
  }

  public async get<T>(key: string): Promise<T | undefined> {
    const val = await this.redisCache.get(key);

    if (val === null || val === undefined) {
      return undefined;
    }
    return this.decodeValue<T>(val);
  }

  public async del(key: string): Promise<void> {
    await this.redisCache.del(key);
  }

  public async mset(args: TMset, ttl?: Milliseconds): Promise<void> {
    if (Array.isArray(args) && args.length === 0) {
      throw new Error(`"args" is empty`);
    }
    const ttlValue = this.getTtl(ttl);

    if (typeof ttlValue === 'number') {
      const multi = this.redisCache.multi();
      for (const [key, value] of args) {
        if (!this.isCacheableValue(value)) {
          throw new Error(`"${value}" is not a cacheable value`);
        }
        await this.redisCache.set(key, value, {PX: ttlValue});
      }
      await multi.exec();

    } else {
      await this.redisCache.mSet(args);
    }
  }

  public async mget<T>(...args: string[]): Promise<(undefined | T)[]> {
    return this.redisCache
      .mGet(args)
      .then((res) =>
        res.map((val) => {
          if (val === null) {
            return undefined;
          }

          return val;
        }) as (undefined | T)[]
      );
  };

  public async mdel(...args: string[]): Promise<void> {
    if (Array.isArray(args)) {
      args = args.flat();
    }
    await this.redisCache.del(args);
  }

  public async reset(): Promise<void> {
    await this.redisCache.flushDb();
  };

  public async keys(pattern: string = '*'): Promise<string[]> {
    return this.redisCache.keys(pattern);
  };

  public async ttl(key: string): Promise<number> {
    return await this.redisCache.ttl(key);
  };

  public async scan(pattern: string, cursor: number = 0, count: number = 10): Promise<ScanReply> {
    return await this.redisCache.scan(cursor, { MATCH: pattern, COUNT: count });
  }

  public getClient(): RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts> {
    return this.redisCache;
  }

  private localIsCacheable(value: unknown): boolean {
    return value !== undefined && value !== null;
  }

  private encodeValue<T>(value: T): string {
    return JSON.stringify(value) || '"undefined"';
  }

  private decodeValue<T>(value: string): T {
    return JSON.parse(value) as T;
  }

  private getTtl(ttl?: Milliseconds): number | undefined {
    if (typeof ttl === 'number') {
      return ttl;
    }
    return this.config?.ttl;
  }
}

