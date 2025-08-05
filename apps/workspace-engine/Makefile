.PHONY: all build clean proto deps run-server run-client test lint help

# Variables
BINARY := bin/workspace-engine
GO := go
GOLINT := golangci-lint

# Default target
all: deps build

# Install dependencies
deps:
	@echo "Installing dependencies..."
	$(GO) mod download
	$(GO) mod tidy


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
	@echo "  make all              - Install deps and build (default)"
	@echo "  make deps             - Install Go dependencies"
	@echo "  make build            - Build binaries"
	@echo "  make dev              - Run without building"
	@echo "  make test             - Run tests"
	@echo "  make test-coverage    - Run tests with coverage report"
	@echo "  make lint             - Run linter"
	@echo "  make fmt              - Format code"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make install-tools    - Install development tools"
	@echo "  make help             - Show this help message"