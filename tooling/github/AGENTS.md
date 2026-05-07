# AGENTS.md

Scoped guidance for `tooling/github` (`@ctrlplane/github`). Inherit the root
instructions first.

## Purpose

This package contains reusable GitHub Actions tooling for the repository.

## Layout

- `setup/action.yml`: composite action for pnpm, Node, Go, jsonnetfmt, Turbo,
  and dependency installation.
- `README.md`: usage notes for referencing actions.

## Conventions

- Composite action changes affect CI and downstream workflows. Keep them
  minimal and backwards-compatible.
- Keep Node and Go versions aligned with repository runtime files and CI needs.
- Avoid adding network-heavy setup steps unless they are required by all
  consumers of the action.

## Verification

- Validate YAML syntax after edits.
- Run or inspect a representative GitHub workflow when changing setup behavior.
