import Redis from 'ioredis';

const redisStore = (...args) => {
  let redisCache = null

  if (args.length > 0 && args[0].clusterConfig) {
    const {
      nodes,
      options
    } = args[0].clusterConfig;

    redisCache = new Redis.Cluster(nodes, options || {});
  } else {
    redisCache = new Redis(...args);
  }

  const storeArgs = redisCache.options;

  return {
    name: 'redis',
    getClient: () => redisCache,
    set: (key, value, options, cb) => (
      new Promise((resolve, reject) => {
        if (typeof options === 'function') {
          cb = options;
          options = {};
        }
        options = options || {};

        if (!cb) {
          cb = (err, result) => (err ? reject(err) : resolve(result));
        }

        const ttl = (options.ttl || options.ttl === 0) ? options.ttl : storeArgs.ttl;
        const val = JSON.stringify(value) || '"undefined"';

        if (ttl) {
          redisCache.setex(key, ttl, val, handleResponse(cb));
        } else {
          redisCache.set(key, val, handleResponse(cb));
        }
      })
    ),
    get: (key, options, cb) => (
      new Promise((resolve, reject) => {
        if (typeof options === 'function') {
          cb = options;
        }

        if (!cb) {
          cb = (err, result) => (err ? reject(err) : resolve(result));
        }

        redisCache.get(key, handleResponse(cb, { parse: true }));
      })
    ),
    del: (key, options, cb) => {
      if (typeof options === 'function') {
        cb = options;
      }

      redisCache.del(key, handleResponse(cb));
    },
    reset: cb => redisCache.flushdb(handleResponse(cb)),
    keys: (pattern, cb) => (
      new Promise((resolve, reject) => {
        if (typeof pattern === 'function') {
          cb = pattern;
          pattern = '*';
        }

        if (!cb) {
          cb = (err, result) => (err ? reject(err) : resolve(result));
        }

        redisCache.keys(pattern, handleResponse(cb));
      })
    ),
    ttl: (key, cb) => redisCache.ttl(key, handleResponse(cb)),
    isCacheableValue: storeArgs.isCacheableValue || (value => value !== undefined && value !== null),
  };
};

function handleResponse(cb, opts = {}) {
  return (err, result) => {
    if (err) {
      return cb && cb(err);
    }

    if (opts.parse) {
      try {
        result = JSON.parse(result);
      } catch (e) {
        return cb && cb(e);
      }
    }

    return cb && cb(null, result);
  };
}

const methods = {
  create: (...args) => redisStore(...args),
};

export default methods;
