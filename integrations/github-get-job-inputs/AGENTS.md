# AGENTS.md

Scoped guidance for `integrations/github-get-job-inputs`
(`@ctrlplane/github-get-job-inputs`). Inherit the root instructions first.

## Purpose

This is the TypeScript source for the GitHub Action that reads a Ctrlplane job
and exposes job fields, variables, resource, version, workspace, environment,
and deployment values as GitHub Action outputs.

## Layout

- `src/index.ts`: action entrypoint, job lookup, recursive output flattening,
  and required-output validation.
- `src/sdk.ts`: typed Ctrlplane API client setup from action inputs.
- `dist`: generated build output. Do not hand-edit.

## Commands

- `pnpm -F @ctrlplane/github-get-job-inputs dev`: run the action source with
  `tsx`.
- `pnpm -F @ctrlplane/github-get-job-inputs build`: compile and bundle with
  `tsc` and `ncc`.
- `pnpm -F @ctrlplane/github-get-job-inputs lint`: run ESLint.
- `pnpm -F @ctrlplane/github-get-job-inputs typecheck`: run TypeScript checks.

## Conventions

- Keep GitHub Action input names aligned with `github/get-job-inputs/action.yml`.
- Sanitize flattened output keys consistently; changing key format is a breaking
  workflow compatibility change.
- Never log API keys or secret values.
- Use the typed `@ctrlplane/web-api` client rather than raw fetch calls.

## Verification

- Run `pnpm -F @ctrlplane/github-get-job-inputs typecheck` and `lint`.
- Run `pnpm -F @ctrlplane/github-get-job-inputs build` when changing action
  behavior or generated output.
