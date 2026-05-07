# AGENTS.md

Scoped guidance for `github/get-job-inputs`. This package is outside the pnpm
workspace globs and appears to contain the bundled GitHub Action output.

## Purpose

This directory publishes the `Get Job Inputs` GitHub Action. It fetches a
Ctrlplane job by ID, flattens job context into GitHub Action outputs, and fails
when required outputs are missing.

## Layout

- `action.yml`: public GitHub Action metadata.
- `index.js`: bundled Node 20 action entrypoint.
- `package.json`: standalone package metadata with no workspace scripts.

## Conventions

- Treat `index.js` as generated/bundled output.
- Prefer changing source in `integrations/github-get-job-inputs` and rebuilding
  the bundle rather than hand-editing this file.
- Keep `action.yml` input/output names stable unless coordinating a breaking
  GitHub Action change.

## Verification

- Validate behavior from the source package when possible.
- If editing this standalone action directly, test it in a real or local
  GitHub Actions-compatible environment before release.
