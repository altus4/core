Test directory structure

- setup/
  - env.setup.js: loads environment variables/misc env hooks for tests.
  - integration.setup.ts: integration-specific setup (mocks mysql/redis/rate limiter).
  - refresh.setup.ts: optional per-test DB refresh when USE_REAL_DB=true.
  - global.setup.ts / global.teardown.ts: optional bridges to legacy global hooks.
- helpers/
  - factories.ts: faker-powered payload factories (seeded for determinism).
  - test-helpers.ts: common helpers (re-export of legacy utils/test-helpers).
  - test-database.ts: DB helper re-export for convenience.
  - refresh-database.ts: TRUNCATE-based DB refresh utility for real DB runs.
- integration/
  - \*.integration.test.ts: SuperTest-based integration suites against createApp().
- performance/
  - \*.performance.test.ts: optional performance checks.

Conventions

- Use SuperTest against the real Express app via createApp().
- Prefer factories.ts + faker with seedSuite() to keep tests reproducible.
- By default, mysql/redis are mocked in integration.setup.ts for speed and determinism.
- To run against a real DB, set USE*REAL_DB=true and configure DB* env vars; the
  refresh.setup.ts hook will TRUNCATE tables before each test.
