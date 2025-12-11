# Build stage - use Debian-based image for newer librdkafka
FROM golang:1.25 AS builder

WORKDIR /app

# Install build dependencies including gcc and librdkafka
RUN apt-get update && apt-get install -y \
    git \
    librdkafka-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy rest of source code
COPY . .

# Build the binary with CGO enabled
# The vendored librdkafka will be statically linked
RUN CGO_ENABLED=1 GOOS=linux go build -o relay .

# Final stage - use Debian slim for glibc compatibility
FROM debian:bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/relay .

# Create non-root user
RUN groupadd -r relay && useradd -r -g relay relay
USER relay

# Expose HTTP API port
EXPOSE 8082

ENV GIN_MODE=release

# Run the binary
CMD ["./relay"]
