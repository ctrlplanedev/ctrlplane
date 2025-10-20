# Build stage - use Debian-based image for newer librdkafka
FROM golang:1.25 AS builder

WORKDIR /app

# Install build dependencies including protobuf, gcc, and librdkafka
RUN apt-get update && apt-get install -y \
    git \
    protobuf-compiler \
    librdkafka-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install protobuf Go plugins
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && \
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy proto files and generate code
COPY proto/ ./proto/
RUN mkdir -p pkg/pb && \
    protoc --go_out=pkg/pb --go_opt=paths=source_relative \
           --go-grpc_out=pkg/pb --go-grpc_opt=paths=source_relative \
           proto/*.proto

# Copy rest of source code
COPY . .

# Build the binary with CGO enabled (required for confluent-kafka-go)
# The vendored librdkafka will be statically linked
RUN CGO_ENABLED=1 GOOS=linux go build -o engine .

# Final stage - use Debian slim for glibc compatibility
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/engine .

# Create non-root user
RUN groupadd -r engine && useradd -r -g engine engine
USER engine

# Expose gRPC port
EXPOSE 8081

ENV GIN_MODE=release

# Run the binary
CMD ["./engine"]
