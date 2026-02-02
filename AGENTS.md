# AGENTS.md

## Repository overview
- Monorepo managed by Turborepo and pnpm
- Primary roots: `apps/`, `packages/`, `integrations/`, `docs/`, `e2e/`
- Key services:
  - `apps/web/` (React/TypeScript)
  - `apps/api/` (TypeScript + jsonnet)
  - `apps/relay/` (Go)
  - `apps/workspace-engine/` (Go)
  - `apps/workspace-engine-router/` (Go)

## Setup
- Use `pnpm` for Node/TypeScript work
- Install dependencies with `pnpm install`

## Common commands
- `pnpm build` - Build all packages
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Run ESLint with auto-fix
- `pnpm format` - Check formatting
- `pnpm format:fix` - Fix formatting
- `pnpm typecheck` - Type check all packages
- `pnpm test` - Run all tests
- `pnpm -F <package-name> test` - Run tests for a specific package
- `pnpm -F <package-name> test -- -t "test name"` - Run a specific test

## Code style guidelines
- TypeScript: use explicit types, prefer interfaces for public APIs
- Imports: named imports, grouped by source (std > external > internal)
- Type imports: `import type { Type } from "module"`
- Prefer async/await over raw promises
- Use functional React components only (no class components)
- Format with Prettier (`@ctrlplane/prettier-config`)
- Go: keep code gofmt-compliant, follow existing patterns in the package

## Testing guidance
- For TypeScript packages, use the existing vitest setup
- For Go services, use `go test` within the relevant module
- Keep tests close to the code that changed when practical

## Agent workflow
- Keep changes focused and minimal
- Avoid editing generated files unless required
- If adding dependencies, use the package manager and latest versions
