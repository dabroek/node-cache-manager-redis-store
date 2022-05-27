import Redis from 'redis';

const prepareKey = (cacheName, key) => `${cacheName}:${key}`
const prepareKeys = (cacheName, keys) => {
    const adjustedKeys = keys.flatMap(key => Array.isArray(key) ? key.map(intKey => prepareKey(cacheName, intKey)) : [prepareKey(cacheName, key)])

    return adjustedKeys
}

const getKeys = async (redisCache, cacheName, pattern = '*') => {
    const rawKeys = await new Promise((resolve, reject) => {
        const cb = (err, result) => (err ? reject(err) : resolve(result))
        return redisCache.keys(`${cacheName}:${pattern}`, cb)
    })

    return rawKeys?.map(key => key.replace(`${cacheName}:`, '')) ?? []
}

const redisStore = (...args) => {
  const redisCache = Redis.createClient(...args);
  const storeArgs = redisCache.options;
  const cacheName = storeArgs && storeArgs.cache_name ? storeArgs.cache_name : 'DEFAULT'

  return {
    name: 'redis',
    getClient: () => redisCache,
    set: function(inKey, value, options, cb) {
      const self = this;
      const key = prepareKey(cacheName, inKey);

      return new Promise((resolve, reject) => {
        if (typeof options === 'function') {
          cb = options;
          options = {};
        }
        options = options || {};

        if (!cb) {
          cb = (err, result) => (err ? reject(err) : resolve(result));
        }

        if (!self.isCacheableValue(value)) {
          return cb(new Error(`"${value}" is not a cacheable value`));
        }

        const ttl = (options.ttl || options.ttl === 0) ? options.ttl : storeArgs.ttl;
        const val = JSON.stringify(value) || '"undefined"';

        if (ttl) {
          redisCache.setex(key, ttl, val, handleResponse(cb));
        } else {
          redisCache.set(key, val, handleResponse(cb));
        }
      })
    },
    mset: function(...args) {
      const self = this;

      return new Promise((resolve, reject) => {
        let cb;
        let options = {};

        if (typeof args[args.length - 1] === 'function') {
          cb = args.pop();
        }

        if (args[args.length - 1] instanceof Object && args[args.length - 1].constructor === Object) {
          options = args.pop();
        }

        if (!cb) {
          cb = (err, result) => (err ? reject(err) : resolve(result));
        }

        const ttl = (options.ttl || options.ttl === 0) ? options.ttl : storeArgs.ttl;

        let multi;
        if (ttl) {
          multi = redisCache.multi();
        }

        let key;
        let value;
        const parsed = [];
        for (let i = 0; i < args.length; i += 2) {
          key = prepareKey(cacheName, args[i]);
          value = args[i + 1];

          /**
           * Make sure the value is cacheable
           */
          if (!self.isCacheableValue(value)) {
            return cb(new Error(`"${value}" is not a cacheable value`));
          }

          value = JSON.stringify(value) || '"undefined"';
          parsed.push(...[key, value]);

          if (ttl) {
            multi.setex(key, ttl, value);
          }
        }

        if (ttl) {
          multi.exec(handleResponse(cb));
        } else {
          redisCache.mset.apply(redisCache, [...parsed, handleResponse(cb)]);
        }
      });
    },
    get: (key, options, cb) => (
      new Promise((resolve, reject) => {
        if (typeof options === 'function') {
          cb = options;
        }

        if (!cb) {
          cb = (err, result) => (err ? reject(err) : resolve(result));
        }

        const adjustedKey = prepareKey(cacheName, key);
        redisCache.get(adjustedKey, handleResponse(cb, { parse: true }));
      })
    ),
    mget: (...args) => (
      new Promise((resolve, reject) => {
        let cb;
        let options = {};

        if (typeof args[args.length - 1] === 'function') {
          cb = args.pop();
        }

        if (args[args.length - 1] instanceof Object && args[args.length - 1].constructor === Object) {
          options = args.pop();
        }

        if (!cb) {
          cb = (err, result) => (err ? reject(err) : resolve(result));
        }

        const adjustedKeys = prepareKeys(cacheName, args);
        redisCache.mget.apply(redisCache, [...adjustedKeys, handleResponse(cb, { parse: true })]);
      })
    ),
    del: (...args) => (
      new Promise((resolve, reject) => {
        let cb;
        let options = {};

        if (typeof args[args.length - 1] === 'function') {
          cb = args.pop();
        }

        if (args[args.length - 1] instanceof Object && args[args.length - 1].constructor === Object) {
          options = args.pop();
        }

        if (!cb) {
          cb = (err, result) => (err ? reject(err) : resolve(result));
        }

        const adjustedKeys = prepareKeys(cacheName, args);
        redisCache.del.apply(redisCache, [...adjustedKeys, handleResponse(cb)]);
      })
    ),
    reset: cb => (
        new Promise(async (resolve, reject) => {
            if (!cb) {
                cb = (err, result) => (err ? reject(err) : resolve(result));
            }

            let allKeys
            try {
                allKeys = await getKeys(redisCache, cacheName, '*', undefined);
            } catch(error) {
                return handleResponse(cb, {keys: []})(error);
            }
            if(allKeys && allKeys.length > 0) {
                redisCache.del.apply(redisCache, [...prepareKeys(cacheName, allKeys), handleResponse(cb, {keys: allKeys})]);
            } else {
                return handleResponse(cb, {keys: []})(null);
            }
        })
    ),
    keys: (pattern = '*', cb) => (
        new Promise(async (resolve, reject) => {
            if (typeof pattern === 'function') {
                cb = pattern;
                pattern = '*';
            }

            if (!cb) {
                cb = (err, result) => (err ? reject(err) : resolve(result));
            }

            try {
                const keys = await getKeys(redisCache, cacheName, pattern, undefined);

                handleResponse(cb, {keys})(null, keys);
            } catch(error) {
                handleResponse(cb)(error);
            }
        })
    ),
    ttl: (key, cb) => (
      new Promise((resolve, reject) => {
        if (!cb) {
          cb = (err, result) => (err ? reject(err) : resolve(result));
        }

        const adjustedKey = prepareKey(cacheName, key);
        redisCache.ttl(adjustedKey, handleResponse(cb));
      })
    ),
    isCacheableValue: storeArgs.is_cacheable_value || (value => value !== undefined && value !== null),
  };
};

function handleResponse(cb, opts = {}) {
  return (err, result) => {
    if (err) {
      return cb && cb(err);
    }

    if (opts.parse) {
      let isMultiple = Array.isArray(result);
      if (!isMultiple) {
        result = [result];
      }

      result = result.map((_result) => {
        try {
          _result = JSON.parse(_result);
        } catch (e) {
          return cb && cb(e);
        }
        return _result;
      });

      result = isMultiple ? result : result[0];
    }

    return cb && cb(null, result);
  };
}

const methods = {
  create: (...args) => redisStore(...args),
};

export default methods;
