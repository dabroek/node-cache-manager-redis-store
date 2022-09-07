'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var redis = require('redis');

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    enumerableOnly && (symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    })), keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = null != arguments[i] ? arguments[i] : {};
    i % 2 ? ownKeys(Object(source), !0).forEach(function (key) {
      _defineProperty(target, key, source[key]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) {
      Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
    });
  }

  return target;
}

function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;

  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }

  return target;
}

function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};

  var target = _objectWithoutPropertiesLoose(source, excluded);

  var key, i;

  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);

    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }

  return target;
}

var _excluded = ["store"];
var generateConnectUrl = function generateConnectUrl() {
  var _config$port;

  var config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var auth = '';
  var connection = "".concat(config.host, ":").concat((_config$port = config.port) !== null && _config$port !== void 0 ? _config$port : 6379);
  var db = '';

  if (config.username || config.password) {
    var _config$user;

    auth = "".concat((_config$user = config.user) !== null && _config$user !== void 0 ? _config$user : '').concat(config.password !== undefined ? ":".concat(config.password) : '', "@");
  }

  if (config.db !== undefined) {
    db = "/".concat(config.db);
  }

  return "redis://".concat(auth).concat(connection).concat(db);
};

var redisStore = function redisStore(args) {
  var store = args.store,
      settings = _objectWithoutProperties(args, _excluded);

  var redisCache = redis.createClient(_objectSpread2(_objectSpread2({}, settings), {}, {
    legacyMode: true
  }));
  var storeArgs = settings;
  var connectedOnce = false;
  redisCache.on('ready', function () {
    connectedOnce = true;
  });

  var connect = function connect() {
    return new Promise(function (resolve, reject) {
      if (connectedOnce) {
        resolve();
      } else {
        redisCache.connect().then(function () {
          resolve();
        })["catch"](function (err) {
          reject(err);
        });
      }
    });
  };

  return {
    name: 'redis',
    getClient: function getClient() {
      return redisCache;
    },
    set: function set(key, value, options, cb) {
      var self = this;
      return new Promise(function (resolve, reject) {
        return connect().then(function () {
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

          if (!self.isCacheableValue(value)) {
            return cb(new Error("\"".concat(value, "\" is not a cacheable value")));
          }

          var ttl = options.ttl || options.ttl === 0 ? options.ttl : storeArgs.ttl;
          var val = JSON.stringify(value) || '"undefined"';

          if (ttl) {
            redisCache.setex(key, ttl, val, handleResponse(cb));
          } else {
            redisCache.set(key, val, handleResponse(cb));
          }
        });
      });
    },
    mset: function mset() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      var self = this;
      return new Promise(function (resolve, reject) {
        return connect().then(function () {
          var cb;
          var options = {};

          if (typeof args[args.length - 1] === 'function') {
            cb = args.pop();
          }

          if (args[args.length - 1] instanceof Object && args[args.length - 1].constructor === Object) {
            options = args.pop();
          }

          if (!cb) {
            cb = function cb(err, result) {
              return err ? reject(err) : resolve(result);
            };
          }

          var ttl = options.ttl || options.ttl === 0 ? options.ttl : storeArgs.ttl;
          var multi;

          if (ttl) {
            multi = redisCache.multi();
          }

          var key;
          var value;
          var parsed = [];

          for (var i = 0; i < args.length; i += 2) {
            key = args[i];
            value = args[i + 1];
            /**
             * Make sure the value is cacheable
             */

            if (!self.isCacheableValue(value)) {
              return cb(new Error("\"".concat(value, "\" is not a cacheable value")));
            }

            value = JSON.stringify(value) || '"undefined"';
            parsed.push.apply(parsed, [key, value]);

            if (ttl) {
              multi.setex(key, ttl, value);
            }
          }

          if (ttl) {
            multi.exec(handleResponse(cb));
          } else {
            redisCache.mset.apply(redisCache, [].concat(parsed, [handleResponse(cb)]));
          }
        });
      });
    },
    get: function get(key, options, cb) {
      return new Promise(function (resolve, reject) {
        return connect().then(function () {
          if (typeof options === 'function') {
            cb = options;
          }

          if (!cb) {
            cb = function cb(err, result) {
              return err ? reject(err) : resolve(result);
            };
          }

          redisCache.get(key, handleResponse(cb, {
            parse: true
          }));
        });
      });
    },
    mget: function mget() {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return new Promise(function (resolve, reject) {
        return connect().then(function () {
          var cb;
          var options = {};

          if (typeof args[args.length - 1] === 'function') {
            cb = args.pop();
          }

          if (args[args.length - 1] instanceof Object && args[args.length - 1].constructor === Object) {
            options = args.pop();
          }

          if (!cb) {
            cb = function cb(err, result) {
              return err ? reject(err) : resolve(result);
            };
          }

          redisCache.mget.apply(redisCache, [].concat(args, [handleResponse(cb, {
            parse: true
          })]));
        });
      });
    },
    del: function del() {
      for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }

      return new Promise(function (resolve, reject) {
        return connect().then(function () {
          var cb;
          var options = {};

          if (typeof args[args.length - 1] === 'function') {
            cb = args.pop();
          }

          if (args[args.length - 1] instanceof Object && args[args.length - 1].constructor === Object) {
            options = args.pop();
          }

          if (!cb) {
            cb = function cb(err, result) {
              return err ? reject(err) : resolve(result);
            };
          }

          redisCache.del.apply(redisCache, [].concat(args, [handleResponse(cb)]));
        });
      });
    },
    reset: function reset(cb) {
      return new Promise(function (resolve, reject) {
        return connect().then(function () {
          if (!cb) {
            cb = function cb(err, result) {
              return err ? reject(err) : resolve(result);
            };
          } //redisCache.flushDb().then(handleResponse(cb));


          redisCache.flushdb(handleResponse(cb));
        });
      });
    },
    keys: function keys() {
      var pattern = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '*';
      var cb = arguments.length > 1 ? arguments[1] : undefined;
      return new Promise(function (resolve, reject) {
        return connect().then(function () {
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
      });
    },
    ttl: function ttl(key, cb) {
      return new Promise(function (resolve, reject) {
        return connect().then(function () {
          if (!cb) {
            cb = function cb(err, result) {
              return err ? reject(err) : resolve(result);
            };
          }

          redisCache.ttl(key, handleResponse(cb));
        });
      });
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
      var isMultiple = Array.isArray(result);

      if (!isMultiple) {
        result = [result];
      }

      result = result.map(function (_result) {
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

var methods = {
  create: function create() {
    return redisStore.apply(void 0, arguments);
  }
};

exports.default = methods;
exports.generateConnectUrl = generateConnectUrl;
