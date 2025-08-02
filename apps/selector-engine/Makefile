.PHONY: all build clean proto deps run-server run-client test lint help

# Variables
PROTO_DIR := proto
PKG_DIR := pkg/pb
SERVER_BINARY := bin/server
CLIENT_BINARY := bin/client
GO := go
PROTOC := protoc
GOLINT := golangci-lint

# Default target
all: deps proto build

# Install dependencies
deps:
	@echo "Installing dependencies..."
	$(GO) mod download
	$(GO) mod tidy
	@echo "Installing protoc plugins..."
	$(GO) install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	$(GO) install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Generate protobuf code
proto:
	@echo "Generating protobuf code..."
	$(PROTOC) --go_out=$(PKG_DIR) --go_opt=paths=source_relative \
		--go-grpc_out=$(PKG_DIR) --go-grpc_opt=paths=source_relative \
		$(PROTO_DIR)/*.proto

# Build binaries
build: build-server build-client

build-server:
	@echo "Building server..."
	@mkdir -p bin
	$(GO) build -o $(SERVER_BINARY) cmd/server/main.go

build-client:
	@echo "Building client..."
	@mkdir -p bin
	$(GO) build -o $(CLIENT_BINARY) cmd/client/main.go

build-all: proto build-server build-client

# Run targets
run-server: build-server
	@echo "Starting server..."
	./$(SERVER_BINARY)

run-client: build-client
	@echo "Starting client..."
	./$(CLIENT_BINARY) -name="Makefile User"

run-client-stream: build-client
	@echo "Starting client with streaming..."
	./$(CLIENT_BINARY) -name="Makefile Stream" -stream

# Development targets
dev-server:
	@echo "Running server in development mode..."
	$(GO) run cmd/server/main.go

dev-client:
	@echo "Running client in development mode..."
	$(GO) run cmd/client/main.go -name="Dev User"

dev-client-stream:
	@echo "Running client with streaming in development mode..."
	$(GO) run cmd/client/main.go -name="Dev Stream" -stream

# Testing
test:
	@echo "Running tests..."
	$(GO) test -v ./...

test-coverage:
	@echo "Running tests with coverage..."
	$(GO) test -v -coverprofile=coverage.out ./...
	$(GO) tool cover -html=coverage.out -o coverage.html

# Linting
lint:
	@echo "Running linter..."
	@if command -v golangci-lint >/dev/null 2>&1; then \
		$(GOLINT) run ./...; \
	else \
		echo "golangci-lint not installed. Install with: brew install golangci-lint"; \
	fi

# Format code
fmt:
	@echo "Formatting code..."
	$(GO) fmt ./...

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf bin/
	rm -f coverage.out coverage.html
	$(GO) clean

# Clean generated protobuf files
clean-proto:
	@echo "Cleaning generated protobuf files..."
	rm -rf $(PKG_DIR)/$(PROTO_DIR)/*.pb.go

# Full clean
clean-all: clean clean-proto

# Docker targets
docker-build-server:
	@echo "Building server Docker image..."
	docker build -t grpc-server:latest -f Dockerfile.server .

docker-build-client:
	@echo "Building client Docker image..."
	docker build -t grpc-client:latest -f Dockerfile.client .

docker-run-server:
	@echo "Running server in Docker..."
	docker run -p 50555:50555 grpc-server:latest

docker-run-client:
	@echo "Running client in Docker..."
	docker run grpc-client:latest -server=host.docker.internal:50555

# Install development tools
install-tools:
	@echo "Installing development tools..."
	@if ! command -v protoc >/dev/null 2>&1; then \
		echo "Please install protoc manually: brew install protobuf"; \
	fi
	@if ! command -v golangci-lint >/dev/null 2>&1; then \
		echo "Installing golangci-lint..."; \
		brew install golangci-lint; \
	fi
	$(GO) install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	$(GO) install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Help target
help:
	@echo "Available targets:"
	@echo "  make all              - Install deps, generate proto, and build (default)"
	@echo "  make deps             - Install Go dependencies"
	@echo "  make proto            - Generate protobuf code"
	@echo "  make build            - Build both server and client binaries"
	@echo "  make build-server     - Build server binary only"
	@echo "  make build-client     - Build client binary only"
	@echo "  make run-server       - Build and run server"
	@echo "  make run-client       - Build and run client (unary RPC)"
	@echo "  make run-client-stream - Build and run client (streaming RPC)"
	@echo "  make dev-server       - Run server without building"
	@echo "  make dev-client       - Run client without building"
	@echo "  make test             - Run tests"
	@echo "  make test-coverage    - Run tests with coverage report"
	@echo "  make lint             - Run linter"
	@echo "  make fmt              - Format code"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make clean-proto      - Clean generated protobuf files"
	@echo "  make clean-all        - Clean everything"
	@echo "  make install-tools    - Install development tools"
	@echo "  make help             - Show this help message"