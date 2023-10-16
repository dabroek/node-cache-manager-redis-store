import {
    createClient,
    RedisClientOptions,
    RedisClientType,
    RedisDefaultModules,
    RedisFunctions,
    RedisModules, RedisScripts
} from 'redis';
import {Config, Store} from 'cache-manager'

export const redisStore = async (config: RedisClientOptions & Config): Promise<Store> => {
    const redisCache: RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts> = createClient(config);
    await redisCache.connect();

    return buildRedisStoreWithConfig(redisCache, config);
}

export type Milliseconds = number;
const buildRedisStoreWithConfig = (redisCache: RedisClientType<RedisDefaultModules & RedisModules, RedisFunctions, RedisScripts>, config: Config): Store => {
    const isCacheable = (value: any): boolean => {
        return value !== undefined && value !== null;
    }
    const getTtl = (ttl?: Milliseconds): number | undefined => {
        if (ttl) {
            return ttl / 1000;
        }
        return config?.ttl;
    }
    const set = async <T>(key: string, value: T | string, ttl?: Milliseconds): Promise<void> => {
        if (!isCacheable(value)) {
            throw new Error(`"${value}" is not a cacheable value`);
        }

        const ttlValue = getTtl(ttl);

        if (ttlValue) {
            await redisCache.setEx(key, ttlValue, encodeValue(value));
        }

        await redisCache.set(key, encodeValue(value));
    };
    const get = async <T>(key: string): Promise<T | undefined> => {
        const val = await redisCache.get(key);

        if (val === null) {
            return undefined;
        }
        return decodeValue<T>(val);
    };
    const del = async (key: string): Promise<void> => {
        await redisCache.del(key);
    };
    const mset = async (args: [string, any][], ttl?: Milliseconds) => {
        const ttlValue = getTtl(ttl);

        const items = args
            .map((key, index) => {
                if (index % 2 !== 0) return null;
                const value = args[index + 1];
                if (!isCacheable(value)) {
                    throw new Error(`"${value}" is not a cacheable value`);
                }
                return [key, encodeValue(value)];
            })
            .filter((key) => key !== null);


        if (ttlValue) {
            const multi = redisCache.multi();
            for (const element of items) {
                /** todo: fix types */
                /** @ts-ignore */
                const [key, value] = element;
                multi.setEx(key, ttlValue, value);
            }
            await multi.exec();
        }

        await redisCache.mSet(args);
    };
    const mget = async <T>(...args: string[]): Promise<(undefined | T)[]> => {
        return redisCache
            .mGet(args)
            .then((res) =>
                res.map((val) => {
                    if (val === null) {
                        return undefined;
                    }

                    return decodeValue(val);
                }),
            );
    };
    const mdel = async (...args: string[]) => {
        if (Array.isArray(args)) {
            args = args.flat();
        }
        await redisCache.del(args);
    };
    const reset = async (): Promise<void> => {
        await redisCache.flushDb();
    };
    const keys = async (pattern: string): Promise<string[]> => {
        return redisCache.keys(pattern);
    };
    const ttl = async (key: string): Promise<number> => {
        return redisCache.ttl(key);
    };

    return {
        set: <T>(key: string, value: T, ttl: Milliseconds) => {
            return set(key, value, ttl);
        },
        get: <T>(key: string): Promise<T | undefined> => {
            return get(key);
        },
        del: (key: string) => {
            return del(key);
        },
        mset: (args: [string, unknown][], ttl?: Milliseconds) => {
            return mset(args, ttl);
        },
        mget: <T>(...args: string[]) => {
            return mget<T>(...args);
        },
        mdel: (...args: string[]) => {
            return mdel(...args);
        },
        reset: (): Promise<void> => {
            return reset();
        },
        keys: (pattern = '*') => {
            return keys(pattern);
        },
        ttl: (key: string) => {
            return ttl(key);
        },
    };
};

const encodeValue = (value: any): string => {
    return JSON.stringify(value) || '"undefined"';
}

const decodeValue = <T>(value: string): T => {
    return JSON.parse(value);
}
