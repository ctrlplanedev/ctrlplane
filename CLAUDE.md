# CtrlPlane Development Guide

## Common Commands
- `pnpm dev` - Run dev server
- `pnpm build` - Build all packages
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Run ESLint with auto-fix
- `pnpm format` - Check formatting
- `pnpm format:fix` - Fix formatting
- `pnpm typecheck` - Type check all packages
- `pnpm test` - Run all tests
- `pnpm -F <package-name> test` - Run tests for a specific package
- `pnpm -F <package-name> test -- -t "test name"` - Run a specific test

## Code Style
- Use TypeScript with explicit types (prefer interfaces for public APIs)
- Import styles: Use named imports, group imports by source (std lib > external > internal)
- Consistent type imports: `import type { Type } from "module"`
- Formatting: Prettier is used with `@ctrlplane/prettier-config`
- Prefer async/await over raw promises
- Adhere to file/directory naming conventions in each package
- Handle errors explicitly (use try/catch and typed error responses)
- Document public APIs and complex logic
- For tests, use vitest with mocks and typed test fixtures

## Monorepo Structure
- Packages are organized in apps/, packages/, integrations/ directories
- Turborepo manages the build pipeline and dependencies
- Shared configs are in the tooling/ directory