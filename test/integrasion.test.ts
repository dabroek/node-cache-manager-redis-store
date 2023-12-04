import {caching} from 'cache-manager';
import {redisStore} from '../src';
import {RedisCache} from "../src/types";
import {describe, beforeEach, expect, it} from "vitest";

let redisCache: RedisCache;
let customRedisCache: RedisCache;

const config = {
    socket: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: 6379
    },
    password: 'redis_password',
    db: 0,
    ttl: 50000,
};

beforeEach(async () => {
    redisCache = await caching(redisStore, config);
    await redisCache.reset();

    const customConfig = {
        ...config,
        isCacheable: (val: any) => {
            if (val === undefined) { // allow undefined
                return true;
            } else if (val === 'FooBarString') { // disallow FooBarString
                return false;
            }
            return redisCache.store.isCacheableValue(val);
        }
    };

    customRedisCache = await caching(redisStore, customConfig);
    await customRedisCache.reset();
});

describe('set', () => {
    it('should return a promise', () => {
        expect(redisCache.set('foo', 'bar')).toBeInstanceOf(Promise);
    });

    it('should store a value without ttl', async () => {
        await redisCache.set('foo', 'bar');
        const value = await redisCache.get('foo');
        const ttl = config.ttl / 1000;
        const ttlValue = await redisCache.store.ttl('foo');
        expect(ttlValue).toBeLessThanOrEqual(ttl);
        expect(value).toEqual('bar');

    });

    it('should store a value with a specific ttl', async () => {
        const ttl = 1000 * 60;
        await redisCache.set('foo', 'bar', ttl);
        await expect(redisCache.store.ttl('foo')).resolves.toBeLessThanOrEqual(ttl / 1000);
    });

    it('should store a value with a infinite ttl', async () => {
        await redisCache.set('foo1', 'bar', 0);
        const ttlValue = await redisCache.store.ttl('foo1');
        expect(ttlValue).toEqual(-1);
    });

    it('should not be able to store a null value (not cacheable)', async () => {
        await expect(redisCache.set('foo', null)).rejects.toThrowError('"null" is not a cacheable value');
    });

    it('should not store an invalid value', async () => {
        await expect(redisCache.set('foo1', undefined)).rejects.toThrowError('"undefined" is not a cacheable value');
    });

    it('should store an undefined value if permitted by isCacheableValue', async () => {
        expect(customRedisCache.store.isCacheableValue(undefined)).toBe(true);
        await customRedisCache.set('foo3', undefined);
    });

    it('should not store a value disallowed by isCacheableValue', async () => {
        expect(customRedisCache.store.isCacheableValue('FooBarString')).toBe(false);
        await expect(customRedisCache.set('foobar', 'FooBarString')).rejects.toThrowError('"FooBarString" is not a cacheable value');
    });

    it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.set('foo', 'bar')).rejects.toBeDefined();
    });
});

describe('get', () => {
    it('should return a promise', async () => {
        expect(redisCache.get('foo')).toBeInstanceOf(Promise);
    });

    it('should retrieve a value for a given key', async () => {
        const value = 'bar';
        await redisCache.set('foo', value);
        await expect(redisCache.get('foo')).resolves.toEqual(value);
    });

    it('should retrieve a value for a given key if options provided', async () => {
        const value = 'bar';
        await redisCache.set('foo', value);
        await expect(redisCache.get('foo')).resolves.toEqual(value);
    });

    it('should return null when the key is invalid', async () => {
        await expect(redisCache.get('invalidKey')).resolves.toEqual(undefined);
    });

    it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.get('foo')).rejects.toThrowError('The client is closed');
    });
});

describe('del', () => {
    it('should return a promise', async () => {
        expect(redisCache.del('foo')).toBeInstanceOf(Promise);
    });

    it('should delete a value for a given key', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.get('foo')).resolves.toEqual('bar');
        await redisCache.del('foo');
        await expect(redisCache.get('foo')).resolves.toEqual(undefined);
    });

    it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.del('foo')).rejects.toThrowError('The client is closed');
    });
});

describe('reset', () => {
    it('should return a promise', async () => {
        expect(redisCache.reset()).toBeInstanceOf(Promise);
    });

    it('should flush underlying db', async () => {
        await redisCache.set('foo', 'bar');
        await redisCache.set('baz', 'qux');
        await redisCache.reset();
        await expect(redisCache.get('foo')).resolves.toEqual(undefined);
        await expect(redisCache.get('baz')).resolves.toEqual(undefined);
    });

    it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.reset()).rejects.toThrowError('The client is closed');
    });
});

describe('ttl', () => {
    it('should return a promise', async () => {
        expect(redisCache.store.ttl('foo')).toBeInstanceOf(Promise);
    });

    it('should retrieve ttl for a given key', async () => {
        await redisCache.set('foo', 'bar');
        await expect(redisCache.store.ttl('foo')).resolves.toEqual(config.ttl / 1000);
    });

    it('should retrieve ttl for an invalid key', async () => {
        await expect(redisCache.store.ttl('invalidKey')).resolves.toEqual(-2);
    });

    it('should return an error if there is an error acquiring a connection', async () => {
        await redisCache.set('foo', 'bar');
        await redisCache.store.getClient().disconnect();
        await expect(redisCache.store.ttl('foo')).rejects.toThrowError('The client is closed');
    });
});

describe('isCacheableValue', () => {
    it('should return true when the value is not undefined', () => {
        expect(redisCache.store.isCacheableValue(0)).toBe(true);
        expect(redisCache.store.isCacheableValue(100)).toBe(true);
        expect(redisCache.store.isCacheableValue('')).toBe(true);
        expect(redisCache.store.isCacheableValue('test')).toBe(true);
    });

    it('should return false when the value is undefined', () => {
        expect(redisCache.store.isCacheableValue(undefined)).toBe(false);
    });

    it('should return false when the value is null', () => {
        expect(redisCache.store.isCacheableValue(null)).toBe(false);
    });
});

describe('overridable isCacheableValue function', () => {
    let redisCache2: RedisCache;

    beforeEach(async () => {
        const newConfig = {
            ...config,
            isCacheable: () => {
                return false;
            },
        };
        redisCache2 = await caching(redisStore, newConfig);
    });

    it('should return its return value instead of the built-in function', () => {
        expect(redisCache2.store.isCacheableValue(0)).toEqual(false);
    });
});
