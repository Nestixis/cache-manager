# Changelog

## [0.1.0] - 2026-10-19

### Breaking changes

- Require NestJS 11.2.1 or newer within the 11.x release line.
- Require Node.js 20.11 or newer for the updated toolchain.

### Changed

- Upgrade NestJS dependencies and development tools to version 11.
- Declare Express types explicitly and correct interceptor request type imports.
- Measure test coverage against production sources.

### Added

- Regression tests for cache keys, serialization, TTL, invalidation and Redis failures.
- Nest module registration and HTTP integration tests.
- An opt-in integration suite for a real Redis server.

Cache runtime behavior remains unchanged.
