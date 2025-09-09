# Repository Guidelines

## Project Structure & Module Organization

- Source: `src/` (controllers, services, middleware, routes, utils, config). Entry: `src/index.ts`, app: `src/app.ts`.
- Tests: `tests/` (unit in `src/**/*.test.ts`, integration in `tests/integration/`, helpers, fixtures, mocks).
- Database: `migrations/` with paired `*.up.sql` and `*.down.sql`.
- Tooling: `bin/` (dev Docker, migrations), `docs/`, build output in `dist/`.

## Build, Test, and Development Commands

- Install: `npm ci` (or `npm install`).
- Dev server: `npm run dev` (nodemon + ts-node).
- Build: `npm run build` (TypeScript compile + `tsc-alias`). Start built app: `npm start`.
- Checks: `npm run check` (typecheck + lint + format check).
- Tests: `npm test` (unit), `npm run test:integration`, `npm run test:coverage`, `npm run test:all`.
- Migrations: `npm run migrate:status|run|rollback|reset|refresh|fresh`.
- Local stack (MySQL + Redis): `npm run dev:start`, stop with `npm run dev:stop`.

## Coding Style & Naming Conventions

- TypeScript, Node 20+. Strict TS enabled.
- Formatting via Prettier (2 spaces, single quotes, semi). Linting via ESLint (`unused-imports`, prefer const, no var, sorted imports).
- Use `PascalCase` for classes, `camelCase` for variables/functions, `SCREAMING_SNAKE_CASE` for env constants.
- File names: `featureName.ts`; tests mirror source: `src/foo/bar.test.ts` or `tests/integration/...`.

## Testing Guidelines

- Framework: Jest (`ts-jest`). Test patterns: `src/**/__tests__/**/*.ts`, `src/**/*.test.ts`, `tests/**/*.test.ts`.
- Coverage thresholds enforced (global: ~75–85%). Use `npm run test:coverage` for reports in `coverage/`.
- Prefer fast unit tests; reserve `tests/integration` for Docker-backed flows (MySQL/Redis). Keep tests deterministic.

## Commit & Pull Request Guidelines

- Conventional Commits required (enforced by Husky): `feat(scope): short description`.
- Enable GPG signing if possible. Pre-commit runs audit, lint, typecheck, build, and tests.
- PRs: include a clear summary, linked issues, test coverage notes, and any migration commands. Add screenshots or logs for behavioral changes.

## Security & Configuration Tips

- Copy `.env.example` to `.env`; never commit secrets. For local DB/Redis use `npm run dev:start`.
- Run `npm run security:audit` regularly; verify signed commits via `npm run security:verify-commits`.
