# Changelog

## v3.0.0 - 15 Oct, 2022

Upgraded to redis@^4

### Breaking Changes

- All functions return Promises by default
- Dropped support for Node.js < 16.18

## v2.0.0 - 13 Feb, 2020

Updates all outdated dependencies. Updating Jest from v20 to v25 revealed that not all tests that asserted a promise rejecting were succeeding as expected. This resulted in the breaking change mentioned below.

### Breaking Changes

- The `set` method now actually checks `isCacheableValue` before setting a value
- Dropped support for Node.js < 8.3
