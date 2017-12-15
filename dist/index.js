'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Redis = _interopDefault(require('redis'));

var redisStore = function redisStore() {
  var redisCache = Redis.createClient.apply(Redis, arguments);
  var storeArgs = redisCache.options;

  return {
    name: 'redis',
    getClient: function getClient() {
      return redisCache;
    },
    set: function set(key, value, options, cb) {
      return new Promise(function (resolve, reject) {
        if (typeof options === 'function') {
          cb = options;
          options = {};
        }
        options = options || {};

        if (!cb) {
          cb = function cb(err, result) {
            return err ? reject(err) : resolve(result);
          };
        }

        var ttl = options.ttl || options.ttl === 0 ? options.ttl : storeArgs.ttl;
        var val = JSON.stringify(value) || '"undefined"';

        if (ttl) {
          redisCache.setex(key, ttl, val, handleResponse(cb));
        } else {
          redisCache.set(key, val, handleResponse(cb));
        }
      });
    },
    get: function get(key, options, cb) {
      return new Promise(function (resolve, reject) {
        if (typeof options === 'function') {
          cb = options;
        }

        if (!cb) {
          cb = function cb(err, result) {
            return err ? reject(err) : resolve(result);
          };
        }

        redisCache.get(key, handleResponse(cb, { parse: true }));
      });
    },
    del: function del(key, options, cb) {
      return new Promise(function (resolve, reject) {
        if (typeof options === 'function') {
          cb = options;
        }

        if (!cb) {
          cb = function cb(err, result) {
            return err ? reject(err) : resolve(result);
          };
        }

        redisCache.del(key, handleResponse(cb));
      });
    },
    reset: function reset(cb) {
      return new Promise(function (resolve, reject) {
        if (!cb) {
          cb = function cb(err, result) {
            return err ? reject(err) : resolve(result);
          };
        }

        redisCache.flushdb(handleResponse(cb));
      });
    },
    keys: function keys(pattern, cb) {
      return new Promise(function (resolve, reject) {
        if (typeof pattern === 'function') {
          cb = pattern;
          pattern = '*';
        }

        if (!cb) {
          cb = function cb(err, result) {
            return err ? reject(err) : resolve(result);
          };
        }

        redisCache.keys(pattern, handleResponse(cb));
      });
    },
    ttl: function ttl(key, cb) {
      return new Promise(function (resolve, reject) {
        if (!cb) {
          cb = function cb(err, result) {
            return err ? reject(err) : resolve(result);
          };
        }

        redisCache.ttl(key, handleResponse(cb));
      });
    },
    isCacheableValue: storeArgs.is_cacheable_value || function (value) {
      return value !== undefined && value !== null;
    }
  };
};

function handleResponse(cb) {
  var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  return function (err, result) {
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

var methods = {
  create: function create() {
    return redisStore.apply(undefined, arguments);
  }
};

module.exports = methods;
