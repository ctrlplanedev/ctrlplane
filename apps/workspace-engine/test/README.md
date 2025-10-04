# Workspace Engine End-to-End Tests

This directory contains end-to-end and integration tests for the workspace-engine in-memory state management system.

## Test Organization

```
test/
├── e2e/                      # End-to-end tests
│   ├── helpers.go           # Test helpers and fixtures
│   ├── workspace_test.go    # Workspace lifecycle tests
│   ├── releasemanager_test.go # Release manager tests
│   └── concurrent_test.go   # Concurrency and race condition tests
├── integration/             # Integration tests
│   ├── server_test.go      # Server startup/shutdown tests
│   └── kafka_test.go       # Kafka integration tests (if applicable)
└── README.md               # This file
```

## Running Tests

### Run All Tests

```bash
cd /Users/justin/Git/ctrlplane/ctrlplane/apps/workspace-engine
make test
```

### Run E2E Tests Only

```bash
go test -v ./test/e2e/...
```

### Run Specific Test

```bash
go test -v ./test/e2e -run TestWorkspaceLifecycle
```

### Run with Race Detection

```bash
go test -race -v ./test/e2e/...
```

### Run Benchmarks

```bash
go test -bench=. -benchmem ./test/e2e/...
```

### Run with Coverage

```bash
go test -coverprofile=coverage.out ./test/e2e/...
go tool cover -html=coverage.out
```

## Test Categories

### 1. Workspace Lifecycle Tests (`workspace_test.go`)

Tests the core CRUD operations for workspace entities:

- Resource management (add, update, delete, get, list)
- Environment management with selectors
- Deployment management with selectors
- Workspace isolation
- Metadata handling
- Complex selector combinations (AND, OR)

**Example:**

```go
func TestWorkspaceLifecycle(t *testing.T) {
    ctx := context.Background()
    ws := NewTestWorkspace(t)

    // Test operations
    resources := CreateTestResources(5, nil)
    for _, r := range resources {
        ws.Resources().Add(ctx, r)
    }

    ws.AssertResourceCount(ctx, 5)
}
```

### 2. Release Manager Tests (`releasemanager_test.go`)

Tests the release manager's sync logic and deployment version management:

- Initial sync (detecting added targets)
- Incremental syncs (detecting changes)
- Detecting added/updated/removed targets
- Deployment version management
- Release target computation with various selector combinations

**Example:**

```go
func TestReleaseManagerSync(t *testing.T) {
    ctx := context.Background()
    ws := NewTestWorkspace(t)

    // Setup and sync
    ws.SeedData(ctx, resources, environments, deployments)
    result := ws.ReleaseManager().Sync(ctx)

    // Verify changes
    if len(result.Changes.Added) == 0 {
        t.Error("expected added targets")
    }
}
```

### 3. Concurrent Operations Tests (`concurrent_test.go`)

Tests for race conditions and concurrent safety:

- Concurrent resource additions/updates/deletions
- Concurrent reads during writes
- Concurrent sync operations
- Materialized view race conditions
- Performance benchmarks

**Example:**

```go
func TestConcurrentResourceOperations(t *testing.T) {
    // Test concurrent adds, reads, updates, deletes
    // Verify no panics or data corruption
}
```

## Test Helpers

The `helpers.go` file provides utilities for test setup:

### Creating Test Data

```go
// Create a single resource
resource := CreateTestResource("id", "name", map[string]string{"key": "value"})

// Create multiple resources with custom metadata
resources := CreateTestResources(10, func(i int) map[string]string {
    return map[string]string{
        "env": fmt.Sprintf("env-%d", i),
    }
})

// Create environments with selectors
environments := CreateTestEnvironments(5, true)

// Create deployments
deployments := CreateTestDeployments(3, true)
```

### Test Workspace Helpers

```go
// Create a test workspace
ws := NewTestWorkspace(t)

// Seed data
ws.SeedData(ctx, resources, environments, deployments)

// Assert counts
ws.AssertResourceCount(ctx, 10)
ws.AssertEnvironmentCount(ctx, 5)
ws.AssertDeploymentCount(ctx, 3)
ws.AssertReleaseTargetCount(ctx, 150)
```

## Writing New Tests

### 1. Unit-Level E2E Tests

For testing a specific feature in isolation:

```go
func TestMyFeature(t *testing.T) {
    ctx := context.Background()
    ws := NewTestWorkspace(t)

    // Setup
    resource := CreateTestResource("r1", "Resource 1", nil)
    ws.Resources().Add(ctx, resource)

    // Test
    retrieved := ws.Resources().Get(ctx, "r1")

    // Assert
    if retrieved == nil {
        t.Fatal("resource not found")
    }
    if retrieved.Name != "Resource 1" {
        t.Errorf("expected name 'Resource 1', got %s", retrieved.Name)
    }
}
```

### 2. Table-Driven Tests

For testing multiple scenarios:

```go
func TestMultipleScenarios(t *testing.T) {
    tests := []struct {
        name     string
        setup    func(*TestWorkspace)
        expected int
    }{
        {
            name: "scenario 1",
            setup: func(ws *TestWorkspace) {
                // Setup code
            },
            expected: 5,
        },
        // More test cases...
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            ws := NewTestWorkspace(t)
            tt.setup(ws)
            // Test and assert
        })
    }
}
```

### 3. Concurrency Tests

For testing thread safety:

```go
func TestConcurrency(t *testing.T) {
    ws := NewTestWorkspace(t)
    var wg sync.WaitGroup

    const numGoroutines = 100
    wg.Add(numGoroutines)

    for i := 0; i < numGoroutines; i++ {
        go func(id int) {
            defer wg.Done()
            // Concurrent operations
        }(i)
    }

    wg.Wait()
    // Assert final state
}
```

## Best Practices

1. **Isolation**: Each test should create its own workspace instance
2. **Cleanup**: Tests automatically clean up when workspace goes out of scope
3. **Assertions**: Use the helper assertion methods for consistency
4. **Context**: Always use `context.Background()` or a timeout context
5. **Race Detection**: Run tests with `-race` flag regularly
6. **Benchmarks**: Include benchmarks for performance-critical paths
7. **Error Handling**: Check for panics in concurrent operations

## Common Patterns

### Testing Selectors

```go
// Create resources with metadata
resources := []*pb.Resource{
    CreateTestResource("r1", "R1", map[string]string{"env": "prod"}),
    CreateTestResource("r2", "R2", map[string]string{"env": "staging"}),
}

// Create environment with selector
env := CreateTestEnvironment("prod-env", "Production", map[string]interface{}{
    "type":     "metadata",
    "operator": "equals",
    "value":    "prod",
    "key":      "env",
})

// Test selector matching
envResources := ws.Environments().Resources("prod-env")
// Assert correct resources matched
```

### Testing Release Manager Sync

```go
// Initial sync
result1 := ws.ReleaseManager().Sync(ctx)
// Should detect all as added

// Modify data
ws.Resources().Add(ctx, newResource)

// Second sync
result2 := ws.ReleaseManager().Sync(ctx)
// Should detect changes
```

## Debugging Failed Tests

### Enable Verbose Output

```bash
go test -v ./test/e2e/...
```

### Run Single Test

```bash
go test -v -run TestWorkspaceLifecycle/AddResources ./test/e2e/...
```

### Print Debug Info

Add logging to tests:

```go
t.Logf("Resources: %d", len(ws.Resources().List(ctx)))
```

### Check for Race Conditions

```bash
go test -race -count=100 ./test/e2e/...
```

## Performance Testing

Run benchmarks to track performance:

```bash
go test -bench=BenchmarkConcurrentResourceOperations -benchmem ./test/e2e/...
```

Example output:

```
BenchmarkConcurrentResourceOperations/Add-8    500000   3245 ns/op   256 B/op   4 allocs/op
BenchmarkConcurrentResourceOperations/Get-8   1000000   1234 ns/op   128 B/op   2 allocs/op
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run E2E Tests
  run: |
    cd apps/workspace-engine
    go test -v -race -coverprofile=coverage.out ./test/e2e/...
    go tool cover -func=coverage.out
```

## Troubleshooting

### Test Timeout

If tests timeout, increase the timeout:

```bash
go test -timeout 5m ./test/e2e/...
```

### Memory Issues

For tests with large datasets:

```bash
GOGC=100 go test ./test/e2e/...
```

### Flaky Tests

If tests are flaky, run multiple times:

```bash
go test -count=10 ./test/e2e/...
```
