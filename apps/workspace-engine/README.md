# Workspace Engine

A high-performance gRPC-based workspace management service for managing workspace resources with real-time event streaming.

## Overview

The Workspace Engine provides a flexible API for creating, managing, and monitoring workspace resources. It includes support for metadata, filtering, pagination, and real-time event streaming to watch workspace changes.

## Features

- **Full CRUD Operations**: Create, Read, Update, Delete workspaces
- **Real-time Event Streaming**: Watch workspace changes via server streaming
- **Metadata Support**: Attach custom metadata to workspaces
- **Filtering & Pagination**: Efficient listing with filters and pagination
- **Status Management**: Track workspace lifecycle states
- **gRPC Performance**: High-performance Protocol Buffers-based API

## Quick Start

### Prerequisites

- Go 1.24+
- Protocol Buffers compiler (`protoc`)
- `protoc-gen-go` and `protoc-gen-go-grpc` plugins

### Installation

```bash
# Install dependencies
make deps

# Install protobuf tools (first time only)
make proto-install

# Generate protobuf code
make proto

# Build the server
make build
```

### Running the Server

Default settings (listens on `0.0.0.0:50051`):

```bash
make dev
```

Or run the built binary:

```bash
./bin/workspace-engine
```

With custom parameters:

```bash
./bin/workspace-engine --host=localhost --port=9090
```

Using environment variables:

```bash
WORKSPACE_ENGINE_HOST=localhost WORKSPACE_ENGINE_PORT=9090 ./bin/workspace-engine
```

### Running the Example Client

```bash
go run examples/client/main.go
```

## Building

### Available Make Targets

```bash
make all              # Install deps, generate proto, and build (default)
make deps             # Install Go dependencies
make proto            # Generate protobuf code
make proto-install    # Install protobuf tools
make build            # Build binaries
make dev              # Run without building
make test             # Run tests
make test-coverage    # Run tests with coverage report
make lint             # Run linter
make sqlc-generate    # Generate typed Go query code from sqlc files
make sqlc-compile     # Validate sqlc config, schema, and queries
make sqlc-verify      # Verify queries against live DB (POSTGRES_URL required)
make fmt              # Format code
make clean            # Clean build artifacts
make install-tools    # Install development tools
make help             # Show help message
```

### SQLC typed queries

`workspace-engine` now includes a starter `sqlc` setup under `./sqlc`.

```bash
make sqlc-generate
```

Generated code is written to `pkg/db/sqlcgen`.

## API Overview

The Workspace Engine provides six main gRPC endpoints:

### Unary RPCs

- `CreateWorkspace`: Create a new workspace with metadata
- `GetWorkspace`: Retrieve a workspace by ID
- `ListWorkspaces`: List workspaces with optional filtering and pagination
- `UpdateWorkspace`: Update workspace properties
- `DeleteWorkspace`: Delete a workspace by ID

### Server Streaming RPCs

- `WatchWorkspaces`: Stream real-time workspace events (create, update, delete)

## Example Usage

```go
package main

import (
    "context"
    "workspace-engine/pkg/client"
    pb "workspace-engine/pkg/pb"
)

func main() {
    // Create client
    c, err := client.New("localhost:50051")
    if err != nil {
        panic(err)
    }
    defer c.Close()

    ctx := context.Background()

    // Create workspace
    ws, err := c.CreateWorkspace(ctx, "my-workspace", "Description", map[string]string{
        "team": "engineering",
    })

    // List workspaces
    workspaces, nextToken, err := c.ListWorkspaces(ctx, 10, "", nil)

    // Watch for changes
    err = c.WatchWorkspaces(ctx, []string{ws.Id}, func(event *pb.WorkspaceEvent) error {
        // Handle event
        return nil
    })
}
```

See `examples/client/main.go` for a complete example.

## Docker Support

Build and run using Docker:

```bash
# Build image
docker build -t workspace-engine:latest -f Dockerfile .

# Run server
docker run -p 50051:50051 workspace-engine:latest
```

## Development

### Project Structure

```
workspace-engine/
├── main.go                 # Server entry point
├── proto/                  # Protocol buffer definitions
│   └── workspace.proto
├── pkg/
│   ├── pb/                # Generated protobuf code
│   ├── server/            # gRPC server implementation
│   └── client/            # Client library
├── examples/
│   └── client/            # Example client usage
├── Makefile               # Build automation
└── README.md
```

### Adding Features

1. Update `proto/workspace.proto` with new messages/services
2. Run `make proto` to regenerate code
3. Implement the service in `pkg/server/server.go`
4. Run `make test` to verify

### Testing

```bash
# Run all tests
make test

# Run with coverage
make test-coverage

# Format code
make fmt

# Lint code
make lint
```

## Configuration

The server can be configured via flags or environment variables:

| Flag     | Environment Variable    | Default   | Description       |
| -------- | ----------------------- | --------- | ----------------- |
| `--host` | `WORKSPACE_ENGINE_HOST` | `0.0.0.0` | Host to listen on |
| `--port` | `WORKSPACE_ENGINE_PORT` | `50051`   | Port to listen on |

## License

[License details here]
