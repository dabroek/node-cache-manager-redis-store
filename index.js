import {callbackify} from 'node:util';
import {createClient} from 'redis';

export async function redisStore(config) {
  const redisCache = createClient(config);
  await redisCache.connect();

  return buildRedisStoreWithConfig(redisCache, config);
}

const buildRedisStoreWithConfig = (redisCache, config) => {
  const isCacheableValue =
    config.isCacheableValue || (value => value !== undefined && value !== null);
  const set = async (key, value, options) => {
    if (!isCacheableValue(value)) {
      throw new Error(`"${value}" is not a cacheable value`);
    }

    const ttl = (options?.ttl || options?.ttl === 0) ? options.ttl : config.ttl;

    if (ttl) {
      return redisCache.setEx(key, ttl, getValue(value));
    } else {
      return redisCache.set(key, getValue(value));
    }
  };
  const get = async (key, options) => {
    const val = await redisCache.get(key);

    if (val === null) {
      return null;
    }
    return options.parse !== false ? JSON.parse(val) : val;
  };
  const del = async (args) => {
    return redisCache.del(args);
  };
  const mset = async (args) => {
    let options;
    if (isObject(args.at(-1))) {
      options = args.pop();
    }
    const ttl = (options?.ttl || options?.ttl === 0) ? options.ttl : config.ttl;

    // Zips even and odd array items into tuples
    const items = args
      .map((key, index) => {
        if (index % 2 !== 0) return null;
        const value = args[index + 1];
        if (!isCacheableValue(value)) {
          throw new Error(`"${value}" is not a cacheable value`);
        }
        return [key, getValue(value)];
      })
      .filter((key) => key !== null);

    if (ttl) {
      const multi = redisCache.multi();
      for (const kv of items) {
        const [key, value] = kv;
        multi.setEx(key, ttl, value);
      }
      return multi.exec();
    } else {
      return redisCache.mSet(items);
    }
  };
  const mget = async (...args) => {
    let options = {};
    if (isObject(args.at(-1))) {
      options = args.pop();
    }
    return redisCache
      .mGet(args)
      .then((res) =>
        res.map((val) => {
          if (val === null) {
            return null;
          }

          return options.parse !== false ? JSON.parse(val) : val;
        }),
      );
  };
  const mdel = async (...args) => {
    if (Array.isArray(args)) {
      args = args.flat();
    }
    return redisCache.del(args);
  };
  const reset = async () => {
    return redisCache.flushDb();
  };
  const keys = async (pattern) => {
    return redisCache.keys(pattern);
  };
  const ttl = async (key) => {
    return redisCache.ttl(key);
  };

  return {
    name: 'redis',
    getClient: () => redisCache,
    isCacheableValue,
    set: (key, value, options, cb) => {
      if (typeof options === 'function') {
        cb = options;
        options = {};
      }
      options = options || {};

      if (typeof cb === 'function') {
        callbackify(set)(key, value, options, cb);
      } else {
        return set(key, value, options);
      }
    },
    get: (key, options, cb) => {
      if (typeof options === 'function') {
        cb = options;
        options = {};
      }
      options = options || {};

      if (typeof cb === 'function') {
        callbackify(get)(key, options, cb);
      } else {
        return get(key, options);
      }
    },
    del: (...args) => {
      if (typeof args.at(-1) === 'function') {
        const cb = args.pop();
        callbackify(del)(args, cb);
      } else {
        return del(args);
      }
    },
    mset: (...args) => {
      if (typeof args.at(-1) === 'function') {
        const cb = args.pop();
        callbackify(mset)(args, cb);
      } else {
        return mset(args);
      }
    },
    mget: (...args) => {
      if (typeof args.at(-1) === 'function') {
        const cb = args.pop();
        callbackify(() => mget(...args))(cb);
      } else {
        return mget(...args);
      }
    },
    mdel: (...args) => {
      if (typeof args.at(-1) === 'function') {
        const cb = args.pop();
        callbackify(() => mdel(...args))(cb);
      } else {
        return mdel(...args);
      }
    },
    reset: (cb) => {
      if (typeof cb === 'function') {
        callbackify(reset)(cb);
      } else {
        return reset();
      }
    },
    keys: (pattern = '*', cb) => {
      if (typeof cb === 'function') {
        callbackify(() => keys(pattern))(cb);
      } else {
        return keys(pattern);
      }
    },
    ttl: (key, cb) => {
      if (typeof cb === 'function') {
        callbackify(() => ttl(key))(cb);
      } else {
        return ttl(key);
      }
    },
  };
};

function getValue(value) {
  return JSON.stringify(value) || '"undefined"';
}

function isObject(object) {
  return typeof object === 'object'
    && !Array.isArray(object)
    && object !== null;
}
