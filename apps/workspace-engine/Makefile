.PHONY: all build clean proto deps run-server run-client test lint help proto-install

# Variables
BINARY := bin/workspace-engine
GO := go
GOLINT := golangci-lint
PROTO_DIR := proto
PB_DIR := pkg/pb

# Default target
all: deps proto build

# Install dependencies
deps:
	@echo "Installing dependencies..."
	$(GO) mod download
	$(GO) mod tidy

# Protocol Buffers
proto:
	@echo "Generating protobuf code..."
	@mkdir -p $(PB_DIR)
	protoc --go_out=$(PB_DIR) --go_opt=paths=source_relative \
		--go-grpc_out=$(PB_DIR) --go-grpc_opt=paths=source_relative \
		--proto_path=$(PROTO_DIR) \
		$(PROTO_DIR)/*.proto
	@echo "Protobuf generation complete"

proto-install:
	@echo "Installing protoc plugins..."
	$(GO) install google.golang.org/protobuf/cmd/protoc-gen-go@latest
	$(GO) install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest
	@echo "Please ensure 'protoc' is installed:"
	@echo "  - macOS: brew install protobuf"
	@echo "  - Linux: apt-get install protobuf-compiler"

build:
	@mkdir -p bin
	$(GO) build -o $(BINARY) main.go


dev:
	@echo "Running in development mode..."
	$(GO) run main.go

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
	rm -rf $(PB_DIR)/*.pb.go
	rm -f coverage.out coverage.html
	$(GO) clean

# Docker targets
docker-build:
	@echo "Building Docker image..."
	docker build -t workspace-engine:latest -f Dockerfile .

# Install development tools
install-tools:
	@echo "Installing development tools..."
	@if ! command -v golangci-lint >/dev/null 2>&1; then \
		echo "Installing golangci-lint..."; \
		brew install golangci-lint; \
	fi

# Help target
help:
	@echo "Available targets:"
	@echo "  make all              - Install deps, generate proto, and build (default)"
	@echo "  make deps             - Install Go dependencies"
	@echo "  make proto            - Generate protobuf code"
	@echo "  make proto-install    - Install protobuf tools"
	@echo "  make build            - Build binaries"
	@echo "  make dev              - Run without building"
	@echo "  make test             - Run tests"
	@echo "  make test-coverage    - Run tests with coverage report"
	@echo "  make lint             - Run linter"
	@echo "  make fmt              - Format code"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make install-tools    - Install development tools"
	@echo "  make help             - Show this help message"

e2e-test:
	@echo "Running all E2E tests in tests/e2e..."
	$(GO) test ./test/e2e/...
