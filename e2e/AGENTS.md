# AGENTS.md

Scoped guidance for `e2e` (`@ctrlplane/e2e`). Inherit the root instructions
first.

## Purpose

This package contains Playwright end-to-end tests for Ctrlplane API and UI
flows. Tests assume the platform can run locally through the root dev setup.

## Layout

- `playwright.config.ts`: projects, base URL, setup dependency, retries, and
  local web server config.
- `tests/auth.setup.ts`: setup project that creates persisted auth/workspace
  state.
- `tests/fixtures.ts`: shared `workspace` and typed API fixtures.
- `tests/api`: API-focused specs.
- `api`: typed OpenAPI client helpers, entity builders, refs, and fixture
  utilities.
- `.state`: generated local test state. Do not commit generated state.

## Commands

- `pnpm -F @ctrlplane/e2e test`: run all Playwright tests.
- `pnpm -F @ctrlplane/e2e test:api`: run API tests.
- `pnpm -F @ctrlplane/e2e test:web`: run UI tests.
- `pnpm -F @ctrlplane/e2e test:debug`: run Playwright in debug mode.
- `pnpm -F @ctrlplane/e2e seed`: run setup seeding.
- `pnpm -F @ctrlplane/e2e generate`: regenerate API test client types.
- `pnpm -F @ctrlplane/e2e install-browsers`: install Playwright browsers.

## Conventions

- Import `test` from `tests/fixtures.ts` when a spec needs workspace or API
  fixtures.
- Prefer API tests for business behavior unless browser interaction is the
  subject of the test.
- Keep test data unique. Use existing entity builders/refs and random prefixes
  when a run may share state with other runs.
- Avoid depending on spec ordering; Playwright runs files in parallel locally.
- Keep generated reports, `.state`, and test results out of commits.

## Verification

- Run the narrowest matching Playwright script first.
- If tests require local services, ensure the root dev stack is running.
