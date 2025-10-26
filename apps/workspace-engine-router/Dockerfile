# Multi-stage build for workspace-engine-router

# Stage 1: Build
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git make gcc musl-dev

WORKDIR /app

# Copy go mod files
COPY apps/workspace-engine-router/go.mod apps/workspace-engine-router/go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY apps/workspace-engine-router/ ./

# Build the binary
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o router-service main.go

# Stage 2: Runtime
FROM alpine:latest

# Install runtime dependencies
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy binary from builder
COPY --from=builder /app/router-service .

# Expose ports
EXPOSE 8080 9090

# Run the service
CMD ["./router-service"]

