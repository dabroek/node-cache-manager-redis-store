'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var Redis = _interopDefault(require('ioredis'));

var redisStore = function redisStore() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  var redisCache = null;

  if (args.length > 0 && args[0].clusterConfig) {
    var _args$0$clusterConfig = args[0].clusterConfig,
        nodes = _args$0$clusterConfig.nodes,
        options = _args$0$clusterConfig.options;


    redisCache = new Redis.Cluster(nodes, options || {});
  } else {
    redisCache = new (Function.prototype.bind.apply(Redis, [null].concat(args)))();
  }

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
      if (typeof options === 'function') {
        cb = options;
      }

      redisCache.del(key, handleResponse(cb));
    },
    reset: function reset(cb) {
      return redisCache.flushdb(handleResponse(cb));
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
      return redisCache.ttl(key, handleResponse(cb));
    },
    isCacheableValue: storeArgs.isCacheableValue || function (value) {
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
