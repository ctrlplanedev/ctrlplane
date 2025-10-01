# Quick Start Guide

This guide will help you get the Workspace Engine up and running in under 5 minutes.

## Prerequisites

Make sure you have the following installed:

- Go 1.24 or later
- `protoc` (Protocol Buffer compiler)
- `make`

## Installation

```bash
# 1. Install protobuf compiler (if not already installed)
brew install protobuf  # macOS
# or
apt-get install protobuf-compiler  # Linux

# 2. Install Go protobuf plugins
make proto-install

# 3. Install dependencies and build
make all
```

## Start the Server

```bash
# Option 1: Run in development mode
make dev

# Option 2: Run the built binary
./bin/workspace-engine

# Option 3: Run with custom settings
./bin/workspace-engine --host=localhost --port=9090
```

You should see output like:

```
INFO Starting workspace engine address=0.0.0.0:50051
INFO gRPC server listening address=0.0.0.0:50051
```

## Test with the Example Client

Open a new terminal and run:

```bash
go run examples/client/main.go
```

You should see output demonstrating all the operations:

```
INFO Creating workspace...
INFO Workspace created id=<uuid> name=my-workspace
INFO Listing workspaces...
INFO Listed workspaces count=1
INFO Workspace id=<uuid> name=my-workspace status=WORKSPACE_STATUS_ACTIVE
INFO Getting workspace...
INFO Got workspace id=<uuid> name=my-workspace
INFO Updating workspace...
INFO Workspace updated name=updated-workspace
INFO Watching workspaces for 5 seconds...
INFO Triggering update while watching...
INFO Workspace event type=EVENT_TYPE_UPDATED workspace=watched-update
INFO Deleting workspace...
INFO Workspace deleted id=<uuid>
INFO Example completed successfully!
```

## Next Steps

### Use the Client Library

```go
package main

import (
    "context"
    "log"
    "workspace-engine/pkg/client"
)

func main() {
    c, err := client.New("localhost:50051")
    if err != nil {
        log.Fatal(err)
    }
    defer c.Close()

    ctx := context.Background()

    ws, err := c.CreateWorkspace(ctx, "test", "Test workspace", nil)
    if err != nil {
        log.Fatal(err)
    }

    log.Printf("Created workspace: %s", ws.Id)
}
```

### Test with grpcurl

If you have `grpcurl` installed:

```bash
# List services
grpcurl -plaintext localhost:50051 list

# Create a workspace
grpcurl -plaintext -d '{
  "name": "test-workspace",
  "description": "Created via grpcurl"
}' localhost:50051 workspace.WorkspaceService/CreateWorkspace

# List workspaces
grpcurl -plaintext -d '{}' localhost:50051 workspace.WorkspaceService/ListWorkspaces
```

### Test with BloomRPC or Postman

1. Open BloomRPC or Postman
2. Import the proto file: `proto/workspace.proto`
3. Connect to `localhost:50051`
4. Start making requests!

## Common Operations

### Create a Workspace

```bash
grpcurl -plaintext -d '{
  "name": "production",
  "description": "Production workspace",
  "metadata": {"env": "prod", "region": "us-east-1"}
}' localhost:50051 workspace.WorkspaceService/CreateWorkspace
```

### List All Workspaces

```bash
grpcurl -plaintext -d '{
  "page_size": 10
}' localhost:50051 workspace.WorkspaceService/ListWorkspaces
```

### Watch for Changes

```bash
grpcurl -plaintext -d '{
  "workspace_ids": []
}' localhost:50051 workspace.WorkspaceService/WatchWorkspaces
```

This will stream events as they happen. Keep it running and make changes in another terminal to see events in real-time.

## Troubleshooting

### Port Already in Use

If port 50051 is already in use, specify a different port:

```bash
./bin/workspace-engine --port=50052
```

And connect the client to the new port:

```bash
# In your code
c, err := client.New("localhost:50052")
```

### Proto Generation Fails

Make sure you have the required tools:

```bash
# Check protoc is installed
protoc --version

# Check Go plugins are in PATH
which protoc-gen-go
which protoc-gen-go-grpc

# If not found, add Go bin to PATH
export PATH=$PATH:$(go env GOPATH)/bin
```

### Build Errors

Clean and rebuild:

```bash
make clean
make all
```

## Development

### Watch for Changes (with Air)

Install Air for live reload:

```bash
go install github.com/air-verse/air@latest
```

Then run:

```bash
air
```

### Format and Lint

```bash
# Format code
make fmt

# Run linter (requires golangci-lint)
make lint
```

## What's Next?

- Check out the [README.md](./README.md) for detailed documentation
- Review the [CLAUDE.md](./CLAUDE.md) for development guidelines
- Explore the example client in `examples/client/main.go`
- Read the proto definitions in `proto/workspace.proto`

Happy coding! 🚀
