# Workspace Engine Router

A production-ready HTTP router service that forwards incoming HTTP requests to the correct workspace-engine worker based on Kafka partition assignment. The router uses consistent hashing (Murmur2) to route workspace requests to the appropriate worker handling that workspace's partition.

## Overview

The workspace-engine-router solves the problem of routing HTTP requests to the correct workspace-engine instance in a distributed deployment. Each workspace-engine worker processes events for specific Kafka partitions, and this router ensures requests for a given workspace are forwarded to the worker handling that workspace's partition.

### Architecture

The router runs **two separate HTTP servers**:

### Management Server (Port 9090)

Handles worker registration and health checks:

- `POST /register` - Worker registration
- `POST /heartbeat` - Worker heartbeats
- `POST /unregister` - Worker unregistration
- `GET /workers` - List workers
- `GET /healthz` - Health check

### Routing Server (Port 8080)

Proxies ALL incoming requests to workers:

- `ANY /*` - All requests are routed based on workspace ID

```
┌─────────────┐
│   Workers   │ ──register──> Management Server :9090
│             │ ──heartbeat─>      │
└─────────────┘                     │
                                    ▼
                             [Worker Registry]
                                    │
Client Request ──> Routing Server :8080
 (X-Workspace-ID)        │
                        ├─ Extract workspace ID from header
                        ├─ Calculate partition (Murmur2)
                        ├─ Lookup worker
                        └─ Proxy to worker
```

**Key Benefits:**

- ✅ **Zero conflicts**: Management and routing are completely isolated
- ✅ **Security**: Management port can be internal-only in Kubernetes
- ✅ **Proxy everything**: All paths are forwarded to workers, not just specific routes
- ✅ **Header-based routing**: Clean separation of routing concerns via `X-Workspace-ID` header

## Features

- ✅ **Zero-config worker discovery** - Workers register themselves via HTTP API
- ✅ **Consistent hashing** - Uses same Murmur2 algorithm as Kafka partitioner
- ✅ **Automatic failover** - Stale workers are automatically removed via TTL
- ✅ **In-memory registry** - No database required (interface-based for future implementations)
- ✅ **OpenTelemetry tracing** - Full observability support
- ✅ **Production-ready** - Includes health checks, logging, CORS, timeouts

## Quick Start

### Running Locally

```bash
# Set environment variables
export KAFKA_BROKERS=localhost:9092
export KAFKA_TOPIC=workspace-events

# Run the router
go run main.go
```

The router will start on `http://0.0.0.0:8080` by default.

### Running with Docker

```bash
# Build the image
docker build -t workspace-engine-router:latest -f Dockerfile .

# Run the container (expose both ports)
docker run -p 8080:8080 -p 9090:9090 \
  -e KAFKA_BROKERS=kafka:9092 \
  -e KAFKA_TOPIC=workspace-events \
  workspace-engine-router:latest
```

## Configuration

All configuration is via environment variables:

| Variable                      | Default                             | Description                              |
| ----------------------------- | ----------------------------------- | ---------------------------------------- |
| `HOST`                        | `0.0.0.0`                           | Host to listen on                        |
| `PORT`                        | `8080`                              | Routing server port                      |
| `MANAGEMENT_PORT`             | `9090`                              | Management server port                   |
| `KAFKA_BROKERS`               | `localhost:9092`                    | Kafka broker addresses                   |
| `KAFKA_TOPIC`                 | `workspace-events`                  | Kafka topic name for workspace events    |
| `WORKER_HEARTBEAT_TIMEOUT`    | `30`                                | Seconds before considering a worker dead |
| `REQUEST_TIMEOUT`             | `30`                                | Request timeout in seconds               |
| `OTEL_SERVICE_NAME`           | `ctrlplane/workspace-engine-router` | OpenTelemetry service name               |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (empty)                             | OpenTelemetry collector endpoint         |

## API Endpoints

### Management Server (Port 9090)

#### Register Worker

```http
POST http://router:9090/register
Content-Type: application/json

{
  "workerId": "uuid-string",
  "httpAddress": "http://worker1:8081",
  "partitions": [0, 1, 2]
}
```

#### Heartbeat

```http
POST http://router:9090/heartbeat
Content-Type: application/json

{
  "workerId": "uuid-string"
}
```

#### Unregister Worker

```http
POST http://router:9090/unregister
Content-Type: application/json

{
  "workerId": "uuid-string"
}
```

#### List Workers

```http
GET http://router:9090/workers
```

Returns all healthy registered workers.

#### Health Check

```http
GET http://router:9090/healthz
```

Returns router health status and number of registered workers.

### Routing Server (Port 8080)

**All requests are proxied to workers.**

The router extracts the workspace ID from the `X-Workspace-ID` header, calculates the partition, and forwards the request to the appropriate worker.

Examples:

```http
GET http://router:8080/v1/deployments
X-Workspace-ID: my-workspace-id

POST http://router:8080/api/jobs
X-Workspace-ID: my-workspace-id

GET http://router:8080/any/path/you/want
X-Workspace-ID: workspace-123
```

**Header-based routing**: Include `X-Workspace-ID` header in all requests. The router will automatically forward to the correct worker based on the workspace's partition.

**Backward compatibility**: If the header is not present, the router will attempt to extract the workspace ID from the path (looking for `/workspaces/{workspaceId}/...` pattern).

## Worker Integration

To register a workspace-engine worker with the router, set the `ROUTER_URL` environment variable:

```bash
export ROUTER_URL=http://router:8080
```

The workspace-engine will automatically:

1. Register on startup with its assigned partitions
2. Send heartbeats every 15 seconds
3. Unregister on graceful shutdown

## Error Handling

- **503 Service Unavailable**: No worker available for the requested workspace
- **400 Bad Request**: Invalid workspace ID in request
- **500 Internal Server Error**: Unexpected error (check logs)

## Development

### Project Structure

```
apps/workspace-engine-router/
├── main.go                          # Entry point
├── pkg/
│   ├── config/
│   │   └── config.go                # Environment configuration
│   ├── registry/
│   │   ├── registry.go              # WorkerRegistry interface
│   │   ├── memory.go                # In-memory implementation
│   │   └── types.go                 # WorkerInfo struct
│   ├── kafka/
│   │   └── metadata.go              # Kafka partition count query
│   ├── partitioner/
│   │   └── partitioner.go           # Murmur2 hash implementation
│   ├── proxy/
│   │   └── proxy.go                 # HTTP reverse proxy
│   └── router/
│       ├── router.go                # Main routing logic
│       └── middleware.go            # Logging, tracing, CORS
├── Dockerfile                       # Multi-stage Docker build
├── go.mod                          # Go module definition
└── README.md                       # This file
```

### Building

```bash
# Install dependencies
go mod download

# Build binary
go build -o router-service main.go

# Run tests (when added)
go test ./...
```

### Testing

You can test the router with mock workers:

```bash
# Start the router
go run main.go

# In another terminal, register a mock worker
curl -X POST http://localhost:8080/api/register \
  -H "Content-Type: application/json" \
  -d '{
    "workerId": "worker-1",
    "httpAddress": "http://localhost:8081",
    "partitions": [0, 1]
  }'

# Check registered workers
curl http://localhost:8080/api/workers

# Send a test request (will be routed to worker-1 if workspace hashes to partition 0 or 1)
curl http://localhost:8080/v1/workspaces/test-workspace-id/status
```

## Deployment

### Kubernetes

Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: workspace-engine-router
spec:
  replicas: 2 # For high availability
  selector:
    matchLabels:
      app: workspace-engine-router
  template:
    metadata:
      labels:
        app: workspace-engine-router
    spec:
      containers:
        - name: router
          image: workspace-engine-router:latest
          ports:
            - containerPort: 8080
              name: routing
            - containerPort: 9090
              name: management
          env:
            - name: KAFKA_BROKERS
              value: "kafka:9092"
            - name: KAFKA_TOPIC
              value: "workspace-events"
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "512Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: workspace-engine-router
spec:
  selector:
    app: workspace-engine-router
  ports:
    - name: routing
      port: 80
      targetPort: 8080
    - name: management
      port: 9090
      targetPort: 9090
  type: LoadBalancer
```

Then configure workspace-engine workers:

```yaml
env:
  - name: ROUTER_URL
    value: "http://workspace-engine-router"
```

### Docker Compose

```yaml
services:
  router:
    build:
      context: .
      dockerfile: apps/workspace-engine-router/Dockerfile
    ports:
      - "8080:8080"
    environment:
      KAFKA_BROKERS: kafka:9092
      KAFKA_TOPIC: workspace-events

  worker:
    build:
      context: .
      dockerfile: apps/workspace-engine/Dockerfile
    environment:
      KAFKA_BROKERS: kafka:9092
      ROUTER_URL: http://router:8080
    depends_on:
      - router
      - kafka
```

## Future Enhancements

- [ ] **Postgres Registry**: Implement `PostgresRegistry` for persistence across router restarts
- [ ] **Redis Registry**: Implement `RedisRegistry` for distributed deployments
- [ ] **Metrics**: Prometheus metrics for request counts, latency, worker health
- [ ] **Circuit Breaker**: Automatic circuit breaking for unhealthy workers
- [ ] **Load Balancing**: Support multiple workers per partition with load balancing
- [ ] **Admin UI**: Web-based dashboard for monitoring workers and routes

## License

[Your license here]
