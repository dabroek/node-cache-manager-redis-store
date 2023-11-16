import {redisStore} from '../src';
import {RedisStore} from "../src/types";
import {describe,beforeEach,it,expect} from "vitest";

let redisClient: RedisStore
const config = {
    socket: {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: 6379
    },
    password: 'redis_password',
    db: 0,
    ttl: 5000,
};
beforeEach(async () => {
    redisClient = await redisStore(config);
    await redisClient.reset();
});
describe('Redis Store', () => {

    it('should set and get a value', async () => {
        const key = 'testKey';
        const value = 'testValue';

        await redisClient.set(key, value);
        const retrievedValue = await redisClient.get(key);

        expect(retrievedValue).toEqual(value);
    });

    it('should delete a key', async () => {
        const key = 'testKey';
        const value = 'testValue';

        await redisClient.set(key, value);
        await redisClient.del(key);

        const retrievedValue = await redisClient.get(key);
        expect(retrievedValue).toBeUndefined();
    });

    it('should set multiple values and get them', async () => {
        const keyValuePairs: [string, string][] = [['key12', 'value1'], ['key22', 'value2']];
        const ttl = 10000;

        await redisClient.mset(keyValuePairs, ttl);

        const retrievedValues = await redisClient.mget('key12', 'key22');
        expect(retrievedValues).toEqual(['value1', 'value2']);
    });

    it('should handle non-cacheable values', async () => {
        const key = 'nonCacheableKey';
        const nonCacheableValue = undefined;

        await expect(redisClient.set(key, nonCacheableValue)).rejects.toThrow(
            `"${nonCacheableValue}" is not a cacheable value`
        );
    });

    it('should handle TTL for individual keys in mset', async () => {
        const key = 'ttlKey';
        const value = 'ttlValue';
        const ttl = 10000;

        await redisClient.mset([[key, value]], ttl);

        const retrievedTtl = await redisClient.ttl(key);
        expect(retrievedTtl).toBeLessThanOrEqual(ttl / 1000); // Redis returns TTL in seconds
    });

    it('should handle TTL for individual keys in set', async () => {
        const key = 'ttlKeySet';
        const value = 'ttlValueSet';
        const ttl = 1000;

        await redisClient.set(key, value, ttl);

        const retrievedTtl = await redisClient.ttl(key);
        expect(retrievedTtl).toBeLessThanOrEqual(ttl / 1000); // Redis returns TTL in seconds
    });
});
