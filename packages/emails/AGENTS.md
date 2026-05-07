# AGENTS.md

Scoped guidance for `packages/emails` (`@ctrlplane/emails`). Inherit the root
instructions first.

## Purpose

This package contains email sending utilities and React Email templates.

## Layout

- `src/client`: nodemailer transport, email payload type, and SMTP env config.
- `src/Welcome.tsx`: React Email template example/component.

## Commands

- `pnpm -F @ctrlplane/emails build`: build the package.
- `pnpm -F @ctrlplane/emails dev`: watch build.
- `pnpm -F @ctrlplane/emails lint`: run ESLint.
- `pnpm -F @ctrlplane/emails typecheck`: run TypeScript checks.
- `pnpm -F @ctrlplane/emails format`: check formatting.

## Conventions

- Add SMTP-related env vars in the existing env module with validation.
- Keep templates compatible with email clients; prefer inline-safe styling and
  React Email components.
- Do not log message contents, SMTP passwords, or recipient-sensitive data.
- Keep send helpers small; provider-specific behavior belongs near the client
  module.

## Verification

- Run `pnpm -F @ctrlplane/emails typecheck` and `lint`.
- Preview or send test emails manually when changing rendered templates.
