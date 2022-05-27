'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var _toConsumableArray = _interopDefault(require('@babel/runtime/helpers/toConsumableArray'));
var _regeneratorRuntime = _interopDefault(require('@babel/runtime/regenerator'));
var _asyncToGenerator = _interopDefault(require('@babel/runtime/helpers/asyncToGenerator'));
var Redis = _interopDefault(require('redis'));

var prepareKey = function prepareKey(cacheName, key) {
  return "".concat(cacheName, ":").concat(key);
};

var prepareKeys = function prepareKeys(cacheName, keys) {
  var adjustedKeys = keys.flatMap(function (key) {
    return Array.isArray(key) ? key.map(function (intKey) {
      return prepareKey(cacheName, intKey);
    }) : [prepareKey(cacheName, key)];
  });
  return adjustedKeys;
};

var getKeys =
/*#__PURE__*/
function () {
  var _ref = _asyncToGenerator(
  /*#__PURE__*/
  _regeneratorRuntime.mark(function _callee(redisCache, cacheName) {
    var _ref2;

    var pattern,
        rawKeys,
        _args = arguments;
    return _regeneratorRuntime.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            pattern = _args.length > 2 && _args[2] !== undefined ? _args[2] : '*';
            _context.next = 3;
            return new Promise(function (resolve, reject) {
              var cb = function cb(err, result) {
                return err ? reject(err) : resolve(result);
              };

              return redisCache.keys("".concat(cacheName, ":").concat(pattern), cb);
            });

          case 3:
            rawKeys = _context.sent;
            return _context.abrupt("return", (_ref2 = rawKeys === null || rawKeys === void 0 ? void 0 : rawKeys.map(function (key) {
              return key.replace("".concat(cacheName, ":"), '');
            })) !== null && _ref2 !== void 0 ? _ref2 : []);

          case 5:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));

  return function getKeys(_x, _x2) {
    return _ref.apply(this, arguments);
  };
}();

var redisStore = function redisStore() {
  var redisCache = Redis.createClient.apply(Redis, arguments);
  var storeArgs = redisCache.options;
  var cacheName = storeArgs && storeArgs.cache_name ? storeArgs.cache_name : 'DEFAULT';
  return {
    name: 'redis',
    getClient: function getClient() {
      return redisCache;
    },
    set: function set(inKey, value, options, cb) {
      var self = this;
      var key = prepareKey(cacheName, inKey);
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
    },
    mset: function mset() {
      for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      var self = this;
      return new Promise(function (resolve, reject) {
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
          key = prepareKey(cacheName, args[i]);
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

        var adjustedKey = prepareKey(cacheName, key);
        redisCache.get(adjustedKey, handleResponse(cb, {
          parse: true
        }));
      });
    },
    mget: function mget() {
      for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
        args[_key2] = arguments[_key2];
      }

      return new Promise(function (resolve, reject) {
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

        var adjustedKeys = prepareKeys(cacheName, args);
        redisCache.mget.apply(redisCache, [].concat(_toConsumableArray(adjustedKeys), [handleResponse(cb, {
          parse: true
        })]));
      });
    },
    del: function del() {
      for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
        args[_key3] = arguments[_key3];
      }

      return new Promise(function (resolve, reject) {
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

        var adjustedKeys = prepareKeys(cacheName, args);
        redisCache.del.apply(redisCache, [].concat(_toConsumableArray(adjustedKeys), [handleResponse(cb)]));
      });
    },
    reset: function reset(cb) {
      return new Promise(
      /*#__PURE__*/
      function () {
        var _ref3 = _asyncToGenerator(
        /*#__PURE__*/
        _regeneratorRuntime.mark(function _callee2(resolve, reject) {
          var allKeys;
          return _regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  if (!cb) {
                    cb = function cb(err, result) {
                      return err ? reject(err) : resolve(result);
                    };
                  }

                  _context2.prev = 1;
                  _context2.next = 4;
                  return getKeys(redisCache, cacheName, '*', undefined);

                case 4:
                  allKeys = _context2.sent;
                  _context2.next = 10;
                  break;

                case 7:
                  _context2.prev = 7;
                  _context2.t0 = _context2["catch"](1);
                  return _context2.abrupt("return", handleResponse(cb, {
                    keys: []
                  })(_context2.t0));

                case 10:
                  if (!(allKeys && allKeys.length > 0)) {
                    _context2.next = 14;
                    break;
                  }

                  redisCache.del.apply(redisCache, [].concat(_toConsumableArray(prepareKeys(cacheName, allKeys)), [handleResponse(cb, {
                    keys: allKeys
                  })]));
                  _context2.next = 15;
                  break;

                case 14:
                  return _context2.abrupt("return", handleResponse(cb, {
                    keys: []
                  })(null));

                case 15:
                case "end":
                  return _context2.stop();
              }
            }
          }, _callee2, null, [[1, 7]]);
        }));

        return function (_x3, _x4) {
          return _ref3.apply(this, arguments);
        };
      }());
    },
    keys: function keys() {
      var pattern = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '*';
      var cb = arguments.length > 1 ? arguments[1] : undefined;
      return new Promise(
      /*#__PURE__*/
      function () {
        var _ref4 = _asyncToGenerator(
        /*#__PURE__*/
        _regeneratorRuntime.mark(function _callee3(resolve, reject) {
          var keys;
          return _regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
              switch (_context3.prev = _context3.next) {
                case 0:
                  if (typeof pattern === 'function') {
                    cb = pattern;
                    pattern = '*';
                  }

                  if (!cb) {
                    cb = function cb(err, result) {
                      return err ? reject(err) : resolve(result);
                    };
                  }

                  _context3.prev = 2;
                  _context3.next = 5;
                  return getKeys(redisCache, cacheName, pattern, undefined);

                case 5:
                  keys = _context3.sent;
                  handleResponse(cb, {
                    keys: keys
                  })(null, keys);
                  _context3.next = 12;
                  break;

                case 9:
                  _context3.prev = 9;
                  _context3.t0 = _context3["catch"](2);
                  handleResponse(cb)(_context3.t0);

                case 12:
                case "end":
                  return _context3.stop();
              }
            }
          }, _callee3, null, [[2, 9]]);
        }));

        return function (_x5, _x6) {
          return _ref4.apply(this, arguments);
        };
      }());
    },
    ttl: function ttl(key, cb) {
      return new Promise(function (resolve, reject) {
        if (!cb) {
          cb = function cb(err, result) {
            return err ? reject(err) : resolve(result);
          };
        }

        var adjustedKey = prepareKey(cacheName, key);
        redisCache.ttl(adjustedKey, handleResponse(cb));
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

module.exports = methods;
