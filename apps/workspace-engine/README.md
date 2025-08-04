# Selector Engine

A high-performance gRPC-based selector engine for matching resources against complex selection criteria.

## Overview

The Selector Engine provides a flexible and efficient way to match resources based on various conditions including IDs, names, metadata, versions, creation dates, and system properties. It supports complex boolean logic with AND/OR operations and nested conditions.

## Features

- **Bidirectional Streaming**: Efficient processing of large volumes of resources and selectors
- **Parallel Processing**: Configurable parallel execution for improved performance
- **Rich Condition Types**: ID, name, metadata, version, date, system properties
- **Boolean Logic**: AND/OR operations with nested conditions
- **Real-time Matching**: Stream resources and get immediate matches

## Quick Start

### Prerequisites

- Go 1.21+
- Protocol Buffers compiler (`protoc`)
- `protoc-gen-go` and `protoc-gen-go-grpc` plugins

### Installation

```bash
go mod download
```

### Running the Server

```bash
go run cmd/server/main.go
```

The server listens on port 50051 by default.

### Running the Client

Basic example:
```bash
go run cmd/client/main.go
```

With custom parameters:
```bash
go run cmd/client/main.go -server=localhost:50051 -resources=1000 -selectors=100
```

## Building

### Build Server and Client

```bash
make build
```

### Generate Protocol Buffers

```bash
make proto
```

### Run Tests

```bash
make test
```

## API Overview

The Selector Engine provides four main gRPC endpoints:

- `LoadResources`: Stream resources and receive matches
- `LoadSelectors`: Stream selectors and receive matches  
- `RemoveResources`: Remove resources by reference
- `RemoveSelectors`: Remove selectors by reference

## Docker Support

Build and run using Docker:

```bash
# Build images
docker build -f Dockerfile.server -t selector-engine-server .
docker build -f Dockerfile.client -t selector-engine-client .

# Run server
docker run -p 50051:50051 selector-engine-server

# Run client
docker run selector-engine-client
```

## License

[License details here]