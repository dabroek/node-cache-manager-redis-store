[![npm version](https://badge.fury.io/js/cache-manager-redis-store.svg)](https://badge.fury.io/js/cache-manager-redis-store)
[![GitHub issues](https://img.shields.io/github/issues/dabroek/node-cache-manager-redis-store.svg)](https://github.com/dabroek/node-cache-manager-redis-store/issues)

Redis store for node cache manager
==================================

Redis cache store for [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager). 

How is this package different from `node-cache-manager-redis`?
----------------------------------------------------------------------------------
This is a **completely different version** than the earlier [node-cache-manager-redis](https://github.com/dial-once/node-cache-manager-redis). This package does not use `redis-pool` which is unnecessary and not actively maintained.
 
This package aims to provide **the most simple wrapper possible** by just passing the configuration to the underlying `node_redis` package.

Installation
------------

```sh
npm install cache-manager-redis-store --save
```
or
```sh
yarn add cache-manager-redis-store
```

Usage Examples
--------------

See examples below on how to implement the Redis cache store.

### Single store

```js
var cacheManager = require('cache-manager');
var redisStore = require('cache-manager-redis-store');

var redisCache = cacheManager.caching({
  store: redisStore,
  host: 'localhost', // default value
  port: 6379, // default value
  auth_pass: 'XXXXX',
  db: 0,
  ttl: 600
});

// listen for redis connection error event
var redisClient = redisCache.store.getClient();

redisClient.on('error', (error) => {
  // handle error here
  console.log(error);
});

var ttl = 5;

redisCache.set('foo', 'bar', { ttl: ttl }, (err) => {
  if (err) {
    throw err;
  }

  redisCache.get('foo', (err, result) => {
    console.log(result);
    // >> 'bar'
    redisCache.del('foo', (err) => {
    });
  });
});

function getUser(id, cb) {
  setTimeout(() => {
    console.log("Returning user from slow database.");
    cb(null, { id: id, name: 'Bob' });
  }, 100);
}

var userId = 123;
var key = `user_${userId}`;

// Note: ttl is optional in wrap()
redisCache.wrap(key, (cb) => {
  getUser(userId, cb);
}, { ttl: ttl }, (err, user) => {
  console.log(user);

  // Second time fetches user from redisCache
  redisCache
    .wrap(key, () => getUser(userId))
    .then(console.log)
    .catch(err => {
      // handle error
    });
});
```

### Multi-store

```js
var cacheManager = require('cache-manager');
var redisStore = require('cache-manager-redis-store');

var redisCache = cacheManager.caching({ store: redisStore, db: 0, ttl: 600 });
var memoryCache = cacheManager.caching({ store: 'memory', max: 100, ttl: 60 });

var multiCache = cacheManager.multiCaching([memoryCache, redisCache]);

var userId2 = 456;
var key2 = `user_${userId2}`;

// Set value in all caches
multiCache.set('foo2', 'bar2', { ttl: ttl }, (err) => {
  if (err) {
    throw err;
  }

  // Fetches from highest priority cache that has the key
  multiCache.get('foo2', (err, result) => {
    console.log(result);

    // Delete from all caches
    multiCache.del('foo2');
  });
});

// Note: ttl is optional in wrap
multiCache.wrap(key2, (cb) => {
  getUser(userId2, cb);
}, (err, user) => {
  console.log(user);

  // Second time fetches user from memoryCache, since it's highest priority.
  // If the data expires in the memory cache, the next fetch would pull it from
  // the 'someOtherCache', and set the data in memory again.
  multiCache.wrap(key2, (cb) => {
    getUser(userId2, cb);
  }, (err, user) => {
    console.log(user);
  });
});
```

Contribution
------------

Want to help improve this package? We take [pull requests](https://github.com/dabroek/node-cache-manager-redis-store/pulls).


License
-------

The `node-cache-manager-redis-store` is licensed under the MIT license.