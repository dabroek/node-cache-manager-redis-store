# Changelog

## v3.0.1 - 17 Oct, 2022

Fixed bug where the `redisStore.del` would no longer accept an options object, which broke the multiCaching interface.

## v3.0.0 - 15 Oct, 2022

Upgraded to redis@^4

### Breaking Changes

- The store needs to be instantiated before passing it to cache-manager and can no longer be instantiated with the factory method
- Dropped support for Node.js < 16.18

## v2.0.0 - 13 Feb, 2020

Updates all outdated dependencies. Updating Jest from v20 to v25 revealed that not all tests that asserted a promise rejecting were succeeding as expected. This resulted in the breaking change mentioned below.

### Breaking Changes

- The `set` method now actually checks `isCacheableValue` before setting a value
- Dropped support for Node.js < 8.3
