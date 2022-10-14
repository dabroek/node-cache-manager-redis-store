import { createClient } from 'redis';
import {URL} from 'url';

export const generateConnectUrl = (config) => {
    const connectionUrl = new URL('redis://example.com')
    connectionUrl.host = config.host
    connectionUrl.port = `${config.port ?? 6379}`
    connectionUrl.username = config.username ?? ''
    connectionUrl.password = config.password ?? ''
    connectionUrl.pathname = config.db ?? ''
    connectionUrl.protocol = 'redis:'
    return connectionUrl.toString()
}

const redisStore = (args) => {
    const {
        store,
        ...settings
    } = args;
  const redisCache = createClient({...settings, legacyMode: true});
  const storeArgs = settings;
  let connectedOnce = false;
  redisCache.on('ready', () => {
      connectedOnce = true;
  })

  const connect = () => {
      return new Promise((resolve, reject) => {
          if(connectedOnce) {
             resolve();
          } else {
              redisCache.connect().then(() => {
                  resolve();
              }).catch((err) => {
                  reject(err);
              })
          }
      })
  }

  return {
    name: 'redis',
    getClient: () => redisCache,
    set: function(key, value, options, cb) {
      const self = this;

      return new Promise((resolve, reject) => {
          return connect().then(() => {
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
          });
      })
    },
    mset: function(...args) {
      const self = this;

      return new Promise((resolve, reject) => {
          return connect().then(() => {
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
              key = args[i];
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
      })
    },
    get: (key, options, cb) => (
      new Promise((resolve, reject) => {
          return connect().then(() => {
              if (typeof options === 'function') {
                  cb = options;
              }

              if (!cb) {
                  cb = (err, result) => (err ? reject(err) : resolve(result));
              }

              redisCache.get(key, handleResponse(cb, {parse: true}));
          });
      })
    ),
    mget: (...args) => (
      new Promise((resolve, reject) => {
          return connect().then(() => {
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

              redisCache.mget.apply(redisCache, [...args, handleResponse(cb, {parse: true})]);
          });
      })
    ),
    del: (...args) => (
      new Promise((resolve, reject) => {
          return connect().then(() => {
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

              redisCache.del.apply(redisCache, [...args, handleResponse(cb)]);
          });
      })
    ),
    reset: cb => (
      new Promise((resolve, reject) => {
          return connect().then(() => {
              if (!cb) {
                  cb = (err, result) => (err ? reject(err) : resolve(result));
              }

              //redisCache.flushDb().then(handleResponse(cb));
              redisCache.flushdb(handleResponse(cb));
          });
      })
    ),
    keys: (pattern = '*', cb) => (
      new Promise((resolve, reject) => {
          return connect().then(() => {
              if (typeof pattern === 'function') {
                  cb = pattern;
                  pattern = '*';
              }

              if (!cb) {
                  cb = (err, result) => (err ? reject(err) : resolve(result));
              }

              redisCache.keys(pattern, handleResponse(cb));
          });
      })
    ),
    ttl: (key, cb) => (
      new Promise((resolve, reject) => {
          return connect().then(() => {
              if (!cb) {
                  cb = (err, result) => (err ? reject(err) : resolve(result));
              }

              redisCache.ttl(key, handleResponse(cb));
          });
      })
    ),
    isCacheableValue: storeArgs.isCacheableValue || (value => value !== undefined && value !== null),
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
