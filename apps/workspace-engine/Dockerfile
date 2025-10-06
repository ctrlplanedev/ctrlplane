# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install build dependencies including protobuf, gcc, and librdkafka
RUN apk add --no-cache \
    git \
    protoc \
    protobuf-dev \
    gcc \
    musl-dev \
    librdkafka-dev \
    pkgconf

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
# Use dynamic linking to avoid glibc/musl incompatibility
RUN CGO_ENABLED=1 GOOS=linux go build -tags dynamic -o engine .

# Final stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies for librdkafka
RUN apk add --no-cache librdkafka

# Copy binary from builder
COPY --from=builder /app/engine .

# Create non-root user
RUN addgroup -S engine && adduser -S engine -G engine
USER engine

# Expose gRPC port
EXPOSE 50051

# Run the binary
CMD ["./engine"]
