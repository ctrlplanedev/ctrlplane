# Workspace Engine Testing Guide

## Overview

This document describes the end-to-end testing strategy for the workspace-engine in-memory state management system.

## Architecture Under Test

The workspace-engine is a high-performance gRPC/Connect service that:

- Manages workspace entities (Resources, Environments, Deployments, Systems, Policies, etc.)
- Uses in-memory concurrent maps for storage
- Computes release targets based on resource selectors
- Manages deployment versions and release policies
- Provides real-time state synchronization through the Release Manager

## Testing Strategy

### 1. Unit Tests (Already Existing)

- Located in `pkg/` directories alongside implementation
- Test individual functions and methods
- Example: `pkg/grpc/releasetarget/computation_test.go`

### 2. End-to-End Tests (New - `test/e2e/`)

- Test complete workflows through the in-memory engine
- Verify state management, selectors, and release manager logic
- Test concurrent operations and race conditions

### 3. Integration Tests (New - `test/integration/`)

- Test the actual gRPC/Connect server
- Verify RPC endpoints and client-server communication
- Test server lifecycle and deployment scenarios

## Test Files

### E2E Tests

#### `test/e2e/helpers.go`

Test utilities and fixtures:

- `NewTestWorkspace(t)` - Creates isolated test workspace
- `CreateTestResource()` - Factory for test resources
- `CreateTestEnvironments()` - Factory for environments with selectors
- `CreateTestDeployments()` - Factory for deployments
- Helper assertions: `AssertResourceCount()`, `AssertReleaseTargetCount()`, etc.

#### `test/e2e/workspace_test.go`

Core workspace operations:

- **TestWorkspaceLifecycle** - Full CRUD operations
- **TestWorkspaceIsolation** - Workspace isolation guarantees
- **TestResourceMetadata** - Metadata handling
- **TestEnvironmentResourceSelector** - Environment selector logic
- **TestDeploymentResourceSelector** - Deployment selector logic
- **TestComplexSelectors** - AND/OR selector combinations

#### `test/e2e/releasemanager_test.go`

Release manager functionality:

- **TestReleaseManagerSync** - Sync operation and change detection
- **TestReleaseManagerWithDeploymentVersions** - Version management
- **TestReleaseTargetComputation** - Target computation scenarios
- **TestReleaseManagerConcurrentSyncs** - Concurrent sync safety

#### `test/e2e/concurrent_test.go`

Concurrency and race conditions:

- **TestConcurrentResourceOperations** - Concurrent CRUD operations
- **TestConcurrentEnvironmentAndDeploymentOperations** - Multi-entity concurrency
- **TestConcurrentSyncAndResourceModification** - Sync during modifications
- **TestRaceConditionsInMaterializedViews** - View consistency
- **BenchmarkConcurrentResourceOperations** - Performance benchmarks

### Integration Tests

#### `test/integration/server_test.go`

Server integration:

- **TestServerStartupShutdown** - Server lifecycle
- **TestComputeReleaseTargets** - RPC endpoint testing
- **TestConcurrentRPCCalls** - Concurrent RPC safety
- **TestServerRestart** - Graceful restart
- **BenchmarkRPCThroughput** - Performance benchmarks

## Running Tests

### Quick Start

```bash
cd apps/workspace-engine

# Run all tests
make test

# Run with race detection
go test -race -v ./...

# Run specific test suite
go test -v ./test/e2e/...
go test -v ./test/integration/...
```

### Detailed Commands

#### Run All Tests

```bash
go test -v ./...
```

#### Run E2E Tests Only

```bash
go test -v ./test/e2e/...
```

#### Run Integration Tests Only

```bash
go test -v ./test/integration/...
```

#### Run Specific Test

```bash
go test -v ./test/e2e -run TestWorkspaceLifecycle
go test -v ./test/e2e -run TestWorkspaceLifecycle/AddResources
```

#### Run with Race Detection (Important!)

```bash
go test -race -v ./test/e2e/...
```

#### Run Multiple Times (Catch Flaky Tests)

```bash
go test -count=100 -race ./test/e2e/concurrent_test.go
```

#### Run with Coverage

```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

#### Run Benchmarks

```bash
go test -bench=. -benchmem ./test/e2e/...
go test -bench=BenchmarkRPCThroughput -benchtime=10s ./test/integration/...
```

## Writing New Tests

### Example: Simple E2E Test

```go
func TestMyFeature(t *testing.T) {
    ctx := context.Background()
    ws := NewTestWorkspace(t)

    // Create test data
    resource := CreateTestResource("r1", "Resource 1", map[string]string{
        "env": "production",
    })

    // Add to workspace
    ws.Resources().Add(ctx, resource)

    // Assert state
    ws.AssertResourceCount(ctx, 1)

    // Retrieve and verify
    retrieved := ws.Resources().Get(ctx, "r1")
    if retrieved == nil {
        t.Fatal("resource not found")
    }
    if retrieved.Metadata["env"] != "production" {
        t.Errorf("unexpected metadata")
    }
}
```

### Example: Table-Driven Test

```go
func TestMultipleScenarios(t *testing.T) {
    tests := []struct {
        name            string
        resources       []*pb.Resource
        environments    []*pb.Environment
        expectedTargets int
    }{
        {
            name:            "empty",
            resources:       []*pb.Resource{},
            environments:    []*pb.Environment{},
            expectedTargets: 0,
        },
        {
            name: "with selectors",
            resources: CreateTestResources(10, func(i int) map[string]string {
                return map[string]string{"env": "prod"}
            }),
            environments:    CreateTestEnvironments(2, true),
            expectedTargets: 20,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ctx := context.Background()
            ws := NewTestWorkspace(t)
            ws.SeedData(ctx, tt.resources, tt.environments, []*pb.Deployment{})
            ws.AssertReleaseTargetCount(ctx, tt.expectedTargets)
        })
    }
}
```

### Example: Concurrency Test

```go
func TestConcurrentOperations(t *testing.T) {
    ctx := context.Background()
    ws := NewTestWorkspace(t)

    const numGoroutines = 100
    var wg sync.WaitGroup
    wg.Add(numGoroutines)

    for i := 0; i < numGoroutines; i++ {
        go func(id int) {
            defer wg.Done()
            resource := CreateTestResource(
                fmt.Sprintf("r-%d", id),
                fmt.Sprintf("Resource %d", id),
                nil,
            )
            ws.Resources().Add(ctx, resource)
        }(i)
    }

    wg.Wait()
    ws.AssertResourceCount(ctx, numGoroutines)
}
```

### Example: Integration Test

```go
func TestRPCEndpoint(t *testing.T) {
    server := NewTestServer(t)
    defer server.Close()

    client := server.NewClient()
    ctx := context.Background()

    request := &pb.ComputeReleaseTargetsRequest{
        Resources:    CreateTestResources(5, nil),
        Environments: CreateTestEnvironments(2, true),
        Deployments:  CreateTestDeployments(2, false),
    }

    resp, err := client.Compute(ctx, connect.NewRequest(request))
    if err != nil {
        t.Fatalf("RPC failed: %v", err)
    }

    if len(resp.Msg.ReleaseTargets) == 0 {
        t.Error("expected some release targets")
    }
}
```

## Test Best Practices

### 1. Isolation

- Each test creates its own workspace instance
- Tests should not depend on execution order
- No shared global state

### 2. Determinism

- Use consistent IDs and metadata
- Avoid time-based assertions (unless testing time)
- Use table-driven tests for multiple scenarios

### 3. Race Detection

- **Always run concurrent tests with `-race` flag**
- The in-memory engine uses concurrent maps
- Race conditions can be subtle and intermittent

### 4. Error Handling

- Check for panics in concurrent operations
- Use defer/recover in goroutines
- Report errors through channels

### 5. Performance

- Include benchmarks for critical paths
- Test with realistic data sizes
- Monitor memory usage

### 6. Documentation

- Name tests descriptively
- Use subtests for different scenarios
- Add comments for complex test logic

## Key Testing Scenarios

### Scenario 1: Resource Management

```go
// Add, Update, Delete, Get, List operations
// Verify metadata handling
// Test concurrent modifications
```

### Scenario 2: Selector Matching

```go
// Test environment selectors
// Test deployment selectors
// Test complex selectors (AND, OR, NOT)
// Test metadata matching
```

### Scenario 3: Release Target Computation

```go
// Verify correct target generation
// Test with various selector combinations
// Test edge cases (empty, no matches, etc.)
```

### Scenario 4: Release Manager Sync

```go
// Initial sync (all targets added)
// Incremental sync (detect changes)
// Handle resource addition/removal
// Handle environment/deployment changes
```

### Scenario 5: Concurrent Operations

```go
// Multiple writers (add/update/delete)
// Multiple readers during writes
// Concurrent syncs
// Materialized view consistency
```

### Scenario 6: Server Integration

```go
// RPC endpoint functionality
// Concurrent RPC calls
// Server startup/shutdown
// Error handling
```

## Debugging Failed Tests

### Enable Verbose Logging

```bash
go test -v ./test/e2e/...
```

### Run Single Test

```bash
go test -v -run TestWorkspaceLifecycle/AddResources ./test/e2e/...
```

### Debug Race Conditions

```bash
# Run many times to catch intermittent failures
go test -race -count=1000 ./test/e2e/concurrent_test.go

# Focus on specific test
go test -race -run TestConcurrentResourceOperations ./test/e2e/...
```

### Profile Tests

```bash
# CPU profiling
go test -cpuprofile=cpu.prof -bench=. ./test/e2e/...
go tool pprof cpu.prof

# Memory profiling
go test -memprofile=mem.prof -bench=. ./test/e2e/...
go tool pprof mem.prof
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-go@v4
        with:
          go-version: "1.24"

      - name: Run Tests
        run: |
          cd apps/workspace-engine
          go test -v -race -coverprofile=coverage.out ./...

      - name: Upload Coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./apps/workspace-engine/coverage.out
```

## Metrics and Coverage

### Target Metrics

- **Code Coverage**: > 80%
- **Concurrent Test Passes**: 100/100 with `-race`
- **Benchmark Stability**: < 5% variance
- **Test Execution Time**: < 30 seconds for full suite

### Measuring Coverage

```bash
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out | grep total
```

### Current Coverage Areas

- ✅ Resource CRUD operations
- ✅ Environment and Deployment management
- ✅ Selector evaluation
- ✅ Release target computation
- ✅ Release manager sync
- ✅ Concurrent operations
- ✅ RPC endpoints
- ⚠️ Kafka integration (mocked/separate)
- ⚠️ Error recovery scenarios

## Future Testing Enhancements

1. **Load Testing**: Test with 10K+ resources
2. **Stress Testing**: Push concurrent operations to limits
3. **Chaos Testing**: Random failures and recovery
4. **Property-Based Testing**: Use `gopter` for property tests
5. **Mutation Testing**: Verify test suite quality
6. **Contract Testing**: Verify API contracts with consumers

## Resources

- [Go Testing Package](https://pkg.go.dev/testing)
- [Go Race Detector](https://go.dev/blog/race-detector)
- [Table-Driven Tests](https://dave.cheney.net/2019/05/07/prefer-table-driven-tests)
- [Connect RPC](https://connectrpc.com/)
- [OpenTelemetry Go](https://opentelemetry.io/docs/instrumentation/go/)

## Questions?

For questions about testing:

1. Check existing test files for patterns
2. Review this document
3. Look at similar tests in the codebase
4. Consult the team
