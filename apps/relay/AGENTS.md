# AGENTS.md

Scoped guidance for `apps/relay` (`@ctrlplane/relay`). Inherit the root
instructions first.

## Purpose

This is a Go WebSocket relay for agent and client communication. It exposes
agent/client connect endpoints and delegates mesh/session behavior to the
`github.com/ctrlplanedev/relay` hub package.

## Layout

- `main.go`: process entry point, OpenTelemetry setup, HTTP route registration.
- `pkg/config`: environment config via `envconfig`.
- `pkg/httphandler`: HTTP/WebSocket handlers for agents, clients, and agent
  listing.
- `Dockerfile`: container packaging.

## Commands

- `pnpm -F @ctrlplane/relay dev`: run with Air.
- `pnpm -F @ctrlplane/relay build`: build the binary.
- `pnpm -F @ctrlplane/relay start`: run the built binary.
- `pnpm -F @ctrlplane/relay test`: run `go test ./...`.
- `pnpm -F @ctrlplane/relay generate`: run `go generate ./...`.
- `pnpm -F @ctrlplane/relay format`: run `go fmt ./...`.

## Conventions

- Keep transport concerns in `pkg/httphandler`; avoid duplicating hub logic.
- Keep config additions in `pkg/config` with explicit env names and defaults.
- Preserve WebSocket protocol compatibility for `/agent/connect` and
  `/client/connect`.
- Keep Go code `gofmt`-clean and avoid comments that restate obvious Go code.

## Verification

- Run `go test ./...` or `pnpm -F @ctrlplane/relay test` after Go changes.
- Run `go fmt ./...` or `pnpm -F @ctrlplane/relay format` before finishing.
