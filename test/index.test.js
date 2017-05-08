import cacheManager from 'cache-manager';
import redisStore from '../index';

let redisCache;
let customRedisCache;

const config = {
  host: '127.0.0.1',
  port: 6379,
  auth_pass: undefined,
  db: 0,
  ttl: 5,
};

beforeEach((done) => {
  redisCache = cacheManager.caching({
    store: redisStore,
    host: config.host,
    port: config.port,
    auth_pass: config.auth_pass,
    db: config.db,
    ttl: config.ttl,
  });

  customRedisCache = cacheManager.caching({
    store: redisStore,
    host: config.host,
    port: config.port,
    auth_pass: config.auth_pass,
    db: config.db,
    ttl: config.ttl,
    isCacheableValue: (val) => {
      if (val === undefined) { // allow undefined
        return true;
      } else if (val === 'FooBarString') { // disallow FooBarString
        return false;
      }
      return redisCache.store.isCacheableValue(val);
    }
  });

  redisCache.store.getClient().once('ready', () => redisCache.reset(done));
});

describe('initialization', () => {
  it('should create a store with password instead of auth_pass (auth_pass is deprecated for redis > 2.5)', (done) => {
    const redisPwdCache = cacheManager.caching({
      store: redisStore,
      host: config.host,
      port: config.port,
      password: config.auth_pass,
      db: config.db,
      ttl: config.ttl
    });

    expect(redisPwdCache.store.getClient().options.password).toEqual(null);
    redisPwdCache.set('pwdfoo', 'pwdbar', (err) => {
      expect(err).toEqual(null);
      redisCache.del('pwdfoo', (errDel) => {
        expect(errDel).toEqual(null);
        done();
      });
    });
  });
});

describe('set', () => {
  it('should return a promise', (done) => {
    expect(redisCache.set('foo', 'bar')).toBeInstanceOf(Promise);
    done();
  });

  it('should resolve promise on success', (done) => {
    redisCache.set('foo', 'bar')
      .then(result => {
        expect(result).toEqual('OK');
        done();
      });
  });

  it('should reject promise on error', (done) => {
    redisCache.set('foo', null)
      .then(() => done(new Error('Should reject')))
      .catch(() => done());
  });

  it('should store a value without ttl', (done) => {
    redisCache.set('foo', 'bar', (err) => {
      expect(err).toEqual(null);
      done();
    });
  });

  it('should store a value with a specific ttl', (done) => {
    redisCache.set('foo', 'bar', config.ttl, (err) => {
      expect(err).toEqual(null);
      done();
    });
  });

  it('should store a value with a infinite ttl', (done) => {
    redisCache.set('foo', 'bar', { ttl: 0 }, (err) => {
      expect(err).toEqual(null);
      redisCache.ttl('foo', (err, ttl) => {
        expect(err).toEqual(null);
        expect(ttl).toEqual(-1);
        done();
      });
    });
  });

  it('should not be able to store a null value (not cacheable)', (done) => {
    redisCache.set('foo2', null, (err) => {
      if (err) {
        return done();
      }
      done(new Error('Null is not a valid value!'));
    });
  });

  it('should store a value without callback', (done) => {
    redisCache.set('foo', 'baz');
    redisCache.get('foo', (err, value) => {
      expect(err).toEqual(null);
      expect(value).toEqual('baz');
      done();
    });
  });

  it('should not store an invalid value', (done) => {
    redisCache.set('foo1', undefined, (err) => {
      try {
        expect(err).not.toEqual(null);
        expect(err.message).toEqual('value cannot be undefined');
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  it('should store an undefined value if permitted by isCacheableValue', (done) => {
    expect(customRedisCache.store.isCacheableValue(undefined), 'check isCacheableValue(undefined) to be true').toBe(true);
    customRedisCache.set('foo3', undefined, (err) => {
      try {
        expect(err).toEqual(null);
        customRedisCache.get('foo3', (err, data) => {
          try {
            expect(err).toEqual(null);
            // redis stored undefined as 'undefined'
            expect(data, 'undefined data should be undefined').toEqual('undefined');
            done();
          } catch (e) {
            done(e);
          }
        });
      } catch (e) {
        done(e);
      }
    });
  });

  it('should not store a value disallowed by isCacheableValue', (done) => {
    expect(customRedisCache.store.isCacheableValue('FooBarString')).toBe(false);
    customRedisCache.set('foobar', 'FooBarString', (err) => {
      try {
        expect(err).not.toEqual(null);
        expect(err.message).toEqual('value cannot be FooBarString');
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  it('should return an error if there is an error acquiring a connection', (done) => {
    redisCache.store.getClient().end(true);
    redisCache.set('foo', 'bar', (err) => {
      expect(err).not.toEqual(null);
      done();
    });
  });
});

describe('get', () => {
  it('should return a promise', (done) => {
    expect(redisCache.get('foo')).toBeInstanceOf(Promise);
    done();
  });

  it('should resolve promise on success', (done) => {
    redisCache.set('foo', 'bar')
      .then(() => redisCache.get('foo'))
      .then(result => {
        expect(result).toEqual('bar');
        done();
      });
  });

  it('should reject promise on error', (done) => {
    redisCache.get('foo')
      .then(() => done(new Error('Should reject')))
      .catch(() => done())
  });

  it('should retrieve a value for a given key', (done) => {
    const value = 'bar';
    redisCache.set('foo', value, () => {
      redisCache.get('foo', (err, result) => {
        expect(err).toEqual(null);
        expect(result).toEqual(value);
        done();
      });
    });
  });

  it('should retrieve a value for a given key if options provided', (done) => {
    const value = 'bar';
    redisCache.set('foo', value, () => {
      redisCache.get('foo', {}, (err, result) => {
        expect(err).toEqual(null);
        expect(result).toEqual(value);
        done();
      });
    });
  });

  it('should return null when the key is invalid', (done) => {
    redisCache.get('invalidKey', (err, result) => {
      expect(err).toEqual(null);
      expect(result).toEqual(null);
      done();
    });
  });

  it('should return an error if there is an error acquiring a connection', (done) => {
    redisCache.store.getClient().end(true);
    redisCache.get('foo', (err) => {
      expect(err).not.toEqual(null);
      done();
    });
  });
});

describe('del', () => {
  it('should delete a value for a given key', (done) => {
    redisCache.set('foo', 'bar', () => {
      redisCache.del('foo', (err) => {
        expect(err).toEqual(null);
        done();
      });
    });
  });

  it('should delete a value for a given key without callback', (done) => {
    redisCache.set('foo', 'bar', () => {
      redisCache.del('foo');
      done();
    });
  });

  it('should return an error if there is an error acquiring a connection', (done) => {
    redisCache.store.getClient().end(true);
    redisCache.del('foo', (err) => {
      expect(err).not.toEqual(null);
      done();
    });
  });
});

describe('reset', () => {
  it('should flush underlying db', (done) => {
    redisCache.reset((err) => {
      expect(err).toEqual(null);
      done();
    });
  });

  it('should flush underlying db without callback', (done) => {
    redisCache.reset();
    done();
  });

  it('should return an error if there is an error acquiring a connection', (done) => {
    redisCache.store.getClient().end(true);
    redisCache.reset((err) => {
      expect(err).not.toEqual(null);
      done();
    });
  });
});

describe('ttl', () => {
  it('should retrieve ttl for a given key', (done) => {
    redisCache.set('foo', 'bar', () => {
      redisCache.ttl('foo', (err, ttl) => {
        expect(err).toEqual(null);
        expect(ttl).toEqual(config.ttl);
        done();
      });
    });
  });

  it('should retrieve ttl for an invalid key', (done) => {
    redisCache.ttl('invalidKey', (err, ttl) => {
      expect(err).toEqual(null);
      expect(ttl).not.toEqual(null);
      done();
    });
  });

  it('should return an error if there is an error acquiring a connection', (done) => {
    redisCache.store.getClient().end(true);
    redisCache.ttl('foo', (err) => {
      expect(err).not.toEqual(null);
      done();
    });
  });
});

describe('keys', () => {
  it('should return a promise', (done) => {
    expect(redisCache.keys('foo')).toBeInstanceOf(Promise);
    done();
  });

  it('should resolve promise on success', (done) => {
    redisCache.set('foo', 'bar')
      .then(() => redisCache.keys('f*'))
      .then(result => {
        expect(result).toEqual(['foo']);
        done();
      });
  });

  it('should reject promise on error', (done) => {
    redisCache.keys('foo')
      .then(() => done(new Error('Should reject')))
      .catch(() => done())
  });

  it('should return an array of keys for the given pattern', (done) => {
    redisCache.set('foo', 'bar', () => {
      redisCache.keys('f*', (err, arrayOfKeys) => {
        expect(err).toEqual(null);
        expect(arrayOfKeys).not.toEqual(null);
        expect(arrayOfKeys.indexOf('foo')).not.toEqual(-1);
        done();
      });
    });
  });

  it('should return an array of keys without pattern', (done) => {
    redisCache.set('foo', 'bar', () => {
      redisCache.keys((err, arrayOfKeys) => {
        expect(err).toEqual(null);
        expect(arrayOfKeys).not.toEqual(null);
        expect(arrayOfKeys.indexOf('foo')).not.toEqual(-1);
        done();
      });
    });
  });

  it('should return an error if there is an error acquiring a connection', (done) => {
    redisCache.store.getClient().end(true);
    redisCache.keys('foo', (err) => {
      expect(err).not.toEqual(null);
      done();
    });
  });
});

describe('isCacheableValue', () => {
  it('should return true when the value is not undefined', (done) => {
    expect(redisCache.store.isCacheableValue(0)).toBe(true);
    expect(redisCache.store.isCacheableValue(100)).toBe(true);
    expect(redisCache.store.isCacheableValue('')).toBe(true);
    expect(redisCache.store.isCacheableValue('test')).toBe(true);
    done();
  });

  it('should return false when the value is undefined', (done) => {
    expect(redisCache.store.isCacheableValue(undefined)).toBe(false);
    done();
  });

  it('should return false when the value is null', (done) => {
    expect(redisCache.store.isCacheableValue(null)).toBe(false);
    done();
  });
});

describe('redis error event', () => {
  it('should return an error when the redis server is unavailable', (done) => {
    redisCache.store.getClient().on('error', (err) => {
      expect(err).not.toEqual(null);
      done();
    });
    redisCache.store.getClient().emit('error', 'Something unexpected');
  });
});

describe('overridable isCacheableValue function', () => {
  let redisCache2;

  beforeEach(() => {
    redisCache2 = cacheManager.caching({
      store: redisStore,
      isCacheableValue: () => {
        return 'I was overridden';
      }
    });
  });

  it('should return its return value instead of the built-in function', (done) => {
    expect(redisCache2.store.isCacheableValue(0)).toEqual('I was overridden');
    done();
  });
});

describe('defaults are set by redis itself', () => {
  let redisCache2;

  beforeEach(() => {
    redisCache2 = cacheManager.caching({
      store: redisStore,
    });
  });

  it('should default the host to `127.0.0.1`', () => {
    expect(redisCache2.store.getClient().connector.options.host).toEqual('localhost');
  });

  it('should default the port to 6379', () => {
    expect(redisCache2.store.getClient().connector.options.port).toEqual(6379);
  });
});

describe('wrap function', () => {
  // Simulate retrieving a user from a database
  function getUser(id, cb) {
    setTimeout(() => {
      cb(null, { id: id });
    }, 100);
  }

  // Simulate retrieving a user from a database with Promise
  function getUserPromise(id) {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ id: id });
      }, 100);
    });
  }

  it('should be able to cache objects', (done) => {
    const userId = 123;

    // First call to wrap should run the code
    redisCache.wrap('wrap-user', (cb) => {
      getUser(userId, cb);
    }, (err, user) => {
      expect(user.id).toEqual(userId);

      // Second call to wrap should retrieve from cache
      redisCache.wrap('wrap-user', (cb) => {
        getUser(userId + 1, cb);
      }, (err, user) => {
        expect(user.id).toEqual(userId);
        done();
      });
    });
  });

  it('should work with promises', () => {
    const userId = 123;

    // First call to wrap should run the code
    return redisCache
      .wrap(
        'wrap-promise',
        () => getUserPromise(userId),
      )
      .then((user) => {
        expect(user.id).toEqual(userId);

        // Second call to wrap should retrieve from cache
        return redisCache.wrap(
          'wrap-promise',
          () => getUserPromise(userId + 1),
        )
          .then((user) => expect(user.id).toEqual(userId));
      });
  });
});
