# Workspace Engine HTTP Server

This package provides a Gin-based HTTP API server for the workspace engine, implementing RESTful endpoints that interact with the OpenAPI schema defined in `pkg/oapi`.

## Architecture

The server provides a clean HTTP REST API interface to the workspace engine's core functionality:

```
┌─────────────────┐
│   HTTP Client   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Gin Router    │  ← Routes & Middleware
│   (server.go)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Workspace     │  ← In-memory workspace state
│   Package       │     (Resources, Deployments, etc.)
└─────────────────┘
```

## Features

### Middleware
- **Logging**: Request/response logging using charmbracelet/log
- **Tracing**: OpenTelemetry distributed tracing integration
- **CORS**: Cross-origin resource sharing support

### API Endpoints

#### Health Check
- `GET /healthz` - Server health status

#### Release Targets
- `POST /api/v1/workspaces/:workspaceId/release-targets/compute` - Compute release targets
- `POST /api/v1/workspaces/:workspaceId/release-targets/list` - List release targets with filtering

#### Deployments
- `POST /api/v1/workspaces/:workspaceId/deployments/list` - List deployments

#### Resources
- `GET /api/v1/workspaces/:workspaceId/resources` - List resources
- `POST /api/v1/workspaces/:workspaceId/resources` - Create/update resource
- `DELETE /api/v1/workspaces/:workspaceId/resources/:resourceId` - Delete resource

#### Environments
- `GET /api/v1/workspaces/:workspaceId/environments` - List environments
- `POST /api/v1/workspaces/:workspaceId/environments` - Create/update environment
- `DELETE /api/v1/workspaces/:workspaceId/environments/:environmentId` - Delete environment

#### Jobs
- `GET /api/v1/workspaces/:workspaceId/jobs` - List jobs
- `GET /api/v1/workspaces/:workspaceId/jobs/:jobId` - Get specific job

#### Releases
- `GET /api/v1/workspaces/:workspaceId/releases` - List releases
- `GET /api/v1/workspaces/:workspaceId/releases/:releaseId` - Get specific release

#### Policies
- `GET /api/v1/workspaces/:workspaceId/policies` - List policies
- `POST /api/v1/workspaces/:workspaceId/policies` - Create/update policy
- `DELETE /api/v1/workspaces/:workspaceId/policies/:policyId` - Delete policy

## Usage

### Basic Setup

```go
package main

import (
    "net/http"
    "workspace-engine/pkg/server"
    "github.com/charmbracelet/log"
)

func main() {
    // Create server instance
    srv := server.New()
    
    // Setup router with all routes and middleware
    router := srv.SetupRouter()
    
    // Create HTTP server
    httpServer := &http.Server{
        Addr:    ":8081",
        Handler: router,
    }
    
    // Start server
    log.Info("Starting server on :8081")
    if err := httpServer.ListenAndServe(); err != nil {
        log.Fatal("Server failed", "error", err)
    }
}
```

### Example API Calls

#### Compute Release Targets
```bash
curl -X POST http://localhost:8081/api/v1/workspaces/ws-123/release-targets/compute \
  -H "Content-Type: application/json" \
  -d '{
    "environments": [...],
    "deployments": [...],
    "resources": [...]
  }'
```

#### List Resources
```bash
curl http://localhost:8081/api/v1/workspaces/ws-123/resources
```

#### Create/Update Resource
```bash
curl -X POST http://localhost:8081/api/v1/workspaces/ws-123/resources \
  -H "Content-Type: application/json" \
  -d '{
    "id": "res-123",
    "name": "My Resource",
    "kind": "kubernetes",
    "identifier": "my-cluster",
    "config": {},
    "metadata": {},
    "workspaceId": "ws-123",
    "version": "v1",
    "createdAt": "2024-01-01T00:00:00Z"
  }'
```

## OpenTelemetry Tracing

All endpoints are instrumented with OpenTelemetry tracing. Traces include:
- HTTP method and path
- Workspace ID
- Resource/Entity IDs
- Response status codes
- Error information

Trace data is exported to the configured OTLP endpoint (via environment variables).

## Error Handling

The server returns standard HTTP status codes:
- `200 OK` - Successful operation
- `400 Bad Request` - Invalid request body/parameters
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error responses follow this format:
```json
{
  "error": "description of error"
}
```

## Migration from Connect RPC

This server replaces the previous Connect RPC implementation. Key changes:

1. **Protocol**: Connect RPC → HTTP REST
2. **Transport**: HTTP/2 with h2c → Standard HTTP/1.1 or HTTP/2
3. **Serialization**: Protobuf → JSON
4. **Routing**: Single Connect endpoint → Multiple REST endpoints

### Migration Steps

1. Replace Connect handler registration:
   ```go
   // OLD
   path, handler := pbconnect.NewReleaseTargetServiceHandler(releasetarget.New())
   mux.Handle(path, handler)
   
   // NEW
   ginServer := server.New()
   router := ginServer.SetupRouter()
   ```

2. Update HTTP server:
   ```go
   // OLD
   server := &http.Server{
       Addr:    addr,
       Handler: h2c.NewHandler(mux, &http2.Server{}),
   }
   
   // NEW
   server := &http.Server{
       Addr:    addr,
       Handler: router,
   }
   ```

3. Update clients to use REST endpoints instead of Connect RPC.

## Testing

```bash
# Run health check
curl http://localhost:8081/healthz

# Should return:
# {"status":"ok","service":"workspace-engine"}
```

## Future Enhancements

- [ ] Add authentication/authorization middleware
- [ ] Implement request rate limiting
- [ ] Add request/response size limits
- [ ] Implement filtering for list endpoints (selectors)
- [ ] Add pagination support for large result sets
- [ ] Generate OpenAPI specification from routes
- [ ] Add API versioning support

