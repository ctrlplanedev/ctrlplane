# Release Verification

The verification package provides automated post-deployment verification for releases in the workspace engine. It continuously monitors release health by running configurable metrics at specified intervals and evaluates success conditions to determine if a deployment is functioning correctly.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Key Components](#key-components)
- [Usage Examples](#usage-examples)
- [Metrics and Providers](#metrics-and-providers)
- [Success Conditions](#success-conditions)
- [Verification Lifecycle](#verification-lifecycle)

## Overview

Release verification allows you to define health checks that run automatically after a deployment. Each verification consists of one or more **metrics** that are measured periodically. Metrics can evaluate HTTP endpoints, custom providers, or any other measurable signal to determine if a release is healthy.

**Key Features:**

- **Automated Monitoring**: Metrics run on configurable intervals (e.g., every 30 seconds)
- **Success Evaluation**: Each measurement is evaluated against a success condition using CEL expressions
- **Early Failure Detection**: Optional failure limits allow verifications to fail fast
- **Concurrent Execution**: Each metric runs in its own goroutine for parallel monitoring
- **Persistent State**: Verification state is stored and can be restored after restarts
- **Graceful Lifecycle**: Verifications can be started, stopped, and resumed

## Architecture

### High-Level Design

```txt
┌─────────────────────────────────────────────────────────────┐
│                      Manager                                 │
│  - Creates verifications for releases                        │
│  - Manages verification lifecycle                            │
│  - Restores in-progress verifications on startup            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      Scheduler                               │
│  - Starts/stops goroutines for each metric                  │
│  - Manages concurrent metric execution                       │
│  - Coordinates measurement timing                            │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
         ┌───────────────┴───────────────┐
         │                               │
         ▼                               ▼
┌──────────────────┐          ┌──────────────────┐
│  Metric Loop 1   │          │  Metric Loop N   │
│  (Goroutine)     │   ...    │  (Goroutine)     │
└────────┬─────────┘          └────────┬─────────┘
         │                               │
         ▼                               ▼
┌──────────────────────────────────────────────────────────────┐
│                   Measurement Flow                            │
│                                                               │
│  1. Provider.Measure() → Collect data (HTTP, etc.)          │
│  2. Evaluator.Evaluate() → Check success condition           │
│  3. Store measurement result                                  │
│  4. Check completion (count reached or failure limit hit)    │
│  5. Continue or stop metric loop                             │
└──────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **Manager** receives a request to verify a release
2. **Manager** creates a `ReleaseVerification` record with metric specifications
3. **Manager** calls **Scheduler** to start goroutines
4. **Scheduler** creates one goroutine per metric with a ticker at the metric's interval
5. Each **metric loop** (goroutine):
   - Builds provider context (release, resource, environment, variables)
   - Calls the **Provider** to collect measurement data
   - Calls the **Evaluator** to check the success condition
   - Stores the measurement in the verification record
   - Checks if the metric is complete (count reached or failure limit hit)
   - Continues or exits based on completion status
6. **Manager** can stop verifications by cancelling goroutines via **Scheduler**

### Concurrency Model

- **Thread-Safe Store Access**: All goroutines read from and write to a shared store with proper synchronization
- **Stateless Goroutines**: Metric loops don't maintain state; they read fresh data from the store on each iteration
- **Isolated Metrics**: Each metric runs independently in its own goroutine
- **Graceful Cancellation**: Context cancellation is used to stop goroutines cleanly

## Key Components

### Manager

The `Manager` is the main entry point for verification operations.

**Responsibilities:**

- Create new verifications for releases
- Start verification goroutines via the scheduler
- Stop verifications
- Restore in-progress verifications after application restart

**Key Methods:**

- `StartVerification(ctx, release, metrics)` - Create and start a new verification
- `StopVerification(ctx, releaseID)` - Cancel a running verification
- `Restore(ctx)` - Resume in-progress verifications on startup

### Scheduler

The `Scheduler` manages goroutines that run metric measurements.

**Responsibilities:**

- Start one goroutine per metric in a verification
- Manage context cancellation for stopping goroutines
- Coordinate timing via tickers
- Handle concurrent start/stop operations safely

**Key Methods:**

- `StartVerification(ctx, verificationID)` - Start goroutines for all metrics
- `StopVerification(verificationID)` - Cancel all goroutines for a verification

### Metrics System

#### Provider

Providers collect raw measurement data. The current implementation includes:

- **HTTP Provider**: Makes HTTP requests and returns response data (status code, body, headers, timing)

**Provider Interface:**

```go
type Provider interface {
    Measure(context.Context, *ProviderContext) (time.Time, map[string]any, error)
    Type() string
}
```

#### Evaluator

The evaluator uses CEL (Common Expression Language) to evaluate success conditions against measurement data.

**Example conditions:**

- `result.statusCode == 200`
- `result.body.status == 'healthy'`
- `result.latency < 500`

#### Measurements

The `Measurements` type provides analysis methods for metric measurements:

- `PassedCount()` - Count of successful measurements
- `FailedCount()` - Count of failed measurements
- `Phase()` - Compute current verification status
- `ShouldContinue()` - Determine if more measurements are needed

## Usage Examples

### Example 1: Basic HTTP Health Check

```go
import (
    "context"
    "workspace-engine/pkg/oapi"
    "workspace-engine/pkg/workspace/releasemanager/verification"
)

func verifyRelease(ctx context.Context, manager *verification.Manager, release *oapi.Release) error {
    // Define a simple HTTP health check metric
    method := oapi.GET
    provider := oapi.MetricProvider{}
    provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
        Url:    "https://my-app.com/health",
        Method: &method,
        Type:   oapi.Http,
    })

    metrics := []oapi.VerificationMetricSpec{
        {
            Name:             "health-check",
            Interval:         "30s",                       // Check every 30 seconds
            Count:            10,                          // Take 10 measurements
            SuccessCondition: "result.statusCode == 200",  // Success if 200 OK
            FailureLimit:     ptr(3),                      // Fail after 3 failures
            Provider:         provider,
        },
    }

    return manager.StartVerification(ctx, release, metrics)
}
```

**What happens:**

1. Verification starts immediately
2. First measurement is taken right away
3. Subsequent measurements occur every 30 seconds
4. Each measurement checks if the HTTP status code is 200
5. If 3 measurements fail, the verification stops and marks as failed
6. If all 10 measurements pass, the verification marks as passed

### Example 2: Multiple Metrics with Different Intervals

```go
func verifyWithMultipleMetrics(ctx context.Context, manager *verification.Manager, release *oapi.Release) error {
    method := oapi.GET

    // Fast health check
    healthProvider := oapi.MetricProvider{}
    healthProvider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
        Url:    "https://my-app.com/health",
        Method: &method,
        Type:   oapi.Http,
    })

    // Slower API check
    apiProvider := oapi.MetricProvider{}
    apiProvider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
        Url:    "https://my-app.com/api/status",
        Method: &method,
        Type:   oapi.Http,
    })

    metrics := []oapi.VerificationMetricSpec{
        {
            Name:             "health-check",
            Interval:         "10s",    // Check every 10 seconds
            Count:            20,       // 20 measurements = ~3 minutes
            SuccessCondition: "result.statusCode == 200",
            FailureLimit:     ptr(5),
            Provider:         healthProvider,
        },
        {
            Name:             "api-check",
            Interval:         "1m",     // Check every minute
            Count:            5,        // 5 measurements = ~5 minutes
            SuccessCondition: "result.statusCode == 200 && result.body.status == 'ok'",
            FailureLimit:     ptr(2),
            Provider:         apiProvider,
        },
    }

    return manager.StartVerification(ctx, release, metrics)
}
```

**What happens:**

1. Two goroutines start, one per metric
2. `health-check` runs every 10 seconds (fast feedback)
3. `api-check` runs every 1 minute (less frequent)
4. Both run concurrently and independently
5. Verification completes when **all** metrics complete
6. Verification fails if **any** metric hits its failure limit

### Example 3: Advanced HTTP Check with Templating

```go
func verifyWithContext(ctx context.Context, manager *verification.Manager, release *oapi.Release) error {
    method := oapi.POST
    timeout := "5s"

    // Use template variables from release context
    body := `{"version": "{{.version.tag}}", "environment": "{{.environment.name}}"}`

    headers := map[string]string{
        "Content-Type": "application/json",
    }

    provider := oapi.MetricProvider{}
    provider.FromHTTPMetricProvider(oapi.HTTPMetricProvider{
        Url:     "https://my-app.com/verify",
        Method:  &method,
        Type:    oapi.Http,
        Timeout: &timeout,
        Body:    &body,
        Headers: &headers,
    })

    metrics := []oapi.VerificationMetricSpec{
        {
            Name:             "deployment-verification",
            Interval:         "45s",
            Count:            8,
            SuccessCondition: "result.statusCode == 200 && result.body.verified == true",
            FailureLimit:     ptr(3),
            Provider:         provider,
        },
    }

    return manager.StartVerification(ctx, release, metrics)
}
```

**What happens:**

1. The request body is templated with release context (version tag, environment name)
2. Provider makes POST requests with the custom body and headers
3. Response is evaluated to check both status code AND response body content
4. This allows for more sophisticated verification logic

### Example 4: Restore Verifications on Startup

```go
func initializeManager(ctx context.Context, store *store.Store) (*verification.Manager, error) {
    manager := verification.NewManager(store)

    // Restore any in-progress verifications from before shutdown
    if err := manager.Restore(ctx); err != nil {
        return nil, fmt.Errorf("failed to restore verifications: %w", err)
    }

    log.Info("Verification manager initialized and verifications restored")
    return manager, nil
}
```

**What happens:**

1. Manager loads all verifications from the store
2. For each verification not in a terminal state (passed/failed/cancelled)
3. Manager restarts the goroutines to continue measurements
4. Verifications resume from where they left off

### Example 5: Manual Verification Control

```go
func controlVerification(ctx context.Context, manager *verification.Manager, release *oapi.Release) error {
    // Start verification
    metrics := []oapi.VerificationMetricSpec{...}
    if err := manager.StartVerification(ctx, release, metrics); err != nil {
        return err
    }

    // Wait for some condition
    time.Sleep(2 * time.Minute)

    // Stop the verification early if needed
    manager.StopVerification(ctx, release.ID())

    log.Info("Verification stopped manually")
    return nil
}
```

## Metrics and Providers

### HTTP Provider

The HTTP provider makes HTTP requests and returns structured measurement data.

**Configuration:**

```go
oapi.HTTPMetricProvider{
    Url:     "https://api.example.com/health",  // Required: URL to request
    Method:  &method,                            // Optional: GET, POST, PUT, etc. (default: GET)
    Timeout: &timeout,                           // Optional: Request timeout (default: 10s)
    Body:    &body,                              // Optional: Request body (supports templating)
    Headers: &headers,                           // Optional: Custom headers
    Type:    oapi.Http,                          // Required: "http"
}
```

**Measurement Data Structure:**

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "X-Request-Id": "abc123"
  },
  "body": {
    "status": "healthy",
    "version": "1.2.3"
  },
  "latency": 145
}
```

**Access in Success Conditions:**

- `result.statusCode` - HTTP status code
- `result.headers.HeaderName` - Response header values
- `result.body.field` - Parsed JSON response body fields
- `result.latency` - Request duration in milliseconds

### Provider Context (Templating)

Providers have access to release context for templating:

**Available Context:**

- `{{.release.id}}` - Release ID
- `{{.version.tag}}` - Version tag (e.g., "v1.2.3")
- `{{.version.id}}` - Version ID
- `{{.resource.name}}` - Resource name
- `{{.resource.kind}}` - Resource kind
- `{{.resource.identifier}}` - Resource identifier
- `{{.environment.name}}` - Environment name
- `{{.environment.id}}` - Environment ID
- `{{.deployment.name}}` - Deployment name
- `{{.variables.customVar}}` - Custom release variables

**Example:**

```go
body := `{
  "version": "{{.version.tag}}",
  "environment": "{{.environment.name}}",
  "resource": "{{.resource.identifier}}"
}`
```

## Success Conditions

Success conditions are CEL (Common Expression Language) expressions that evaluate measurement data.

### Basic Examples

```cel
// Simple status check
result.statusCode == 200

// Multiple conditions
result.statusCode == 200 && result.latency < 1000

// Check response body
result.body.status == "healthy"

// Complex logic
result.statusCode == 200 && result.body.replicas > 0 && result.body.ready == true
```

### Advanced Examples

```cel
// Range check
result.statusCode >= 200 && result.statusCode < 300

// String operations
result.body.message.startsWith("Success")

// Numeric comparisons
result.latency < 500 && result.body.cpu_usage < 80.0

// Conditional logic
result.statusCode == 200 ? result.body.status == "ok" : false

// List operations
result.body.errors.size() == 0
```

### Available Functions

CEL provides many built-in functions:

- String: `startsWith()`, `endsWith()`, `contains()`, `matches()`
- Math: `<`, `>`, `<=`, `>=`, `==`, `!=`
- Logical: `&&`, `||`, `!`
- Lists: `size()`, `in`
- Ternary: `condition ? true_value : false_value`

## Verification Lifecycle

### States

A verification can be in one of the following states:

1. **Running** - Metrics are actively being measured
2. **Passed** - All metrics completed successfully
3. **Failed** - One or more metrics hit their failure limit
4. **Cancelled** - Verification was manually stopped

### State Transitions

```
                    ┌─────────────┐
                    │   Created   │
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────┐
              ┌────▶│   Running   │────┐
              │     └──────┬──────┘    │
              │            │           │
    Restore() │            │           │ StopVerification()
              │            ▼           │
              │     ┌─────────────┐    │
              │     │   Passed    │    │
              │     └─────────────┘    │
              │                        │
              │     ┌─────────────┐    │
              │     │   Failed    │    │
              │     └─────────────┘    │
              │                        │
              │     ┌─────────────┐    │
              └─────│  Cancelled  │◀───┘
                    └─────────────┘
```

### Completion Logic

A verification completes when **all** its metrics complete.

A metric completes when:

1. It has taken `count` measurements, OR
2. It has reached `failureLimit` failed measurements

**Examples:**

| Metric Config              | Measurements Taken  | Result                     |
| -------------------------- | ------------------- | -------------------------- |
| count=10, failureLimit=3   | 5 passed, 3 failed  | Failed (hit failure limit) |
| count=10, failureLimit=3   | 10 passed, 0 failed | Passed (count reached)     |
| count=10, failureLimit=nil | 10 passed, 0 failed | Passed                     |
| count=10, failureLimit=nil | 7 passed, 3 failed  | Passed (no failure limit)  |
| count=10, failureLimit=5   | 6 passed, 5 failed  | Failed (hit failure limit) |

### Automatic Cleanup

- Metric goroutines automatically exit when their metric completes
- No manual cleanup is required for completed verifications
- The scheduler only tracks running verifications
- Stopped verifications are removed from the scheduler's active set

## Performance Considerations

### Scalability

- Each metric runs in its own goroutine (lightweight)
- Hundreds of concurrent verifications are supported
- Store operations are the main bottleneck
- Use appropriate intervals to avoid overwhelming target systems

### Best Practices

1. **Interval Selection**
   - Use longer intervals (1-5 minutes) for production
   - Use shorter intervals (10-30 seconds) for quick feedback in testing
   - Consider the target system's capacity

2. **Failure Limits**
   - Always set a `failureLimit` to fail fast
   - Typical value: 2-3 failures for critical checks
   - Higher values (5-10) for non-critical or flaky checks

3. **Measurement Count**
   - Balance coverage vs. duration
   - 10-20 measurements is typical
   - Consider: `duration ≈ count × interval`

4. **Success Conditions**
   - Keep conditions simple and fast to evaluate
   - Avoid complex operations in CEL expressions
   - Test conditions thoroughly before deployment

### Resource Usage

- **Memory**: O(verifications × metrics × measurements)
- **Goroutines**: O(running_verifications × metrics)
- **Store I/O**: O(measurements_per_second)

Monitor these metrics to ensure healthy system operation.

## Testing

The package includes comprehensive tests:

- **Unit Tests**: Test individual components in isolation
- **Integration Tests**: Test the full verification flow with real timing
- **Benchmark Tests**: Measure performance under load

Run tests:

```bash
go test -v ./pkg/workspace/releasemanager/verification/...
```

Run with race detector:

```bash
go test -race ./pkg/workspace/releasemanager/verification/...
```

Skip integration tests:

```bash
go test -short ./pkg/workspace/releasemanager/verification/...
```

## Future Enhancements

Potential improvements for the verification system:

1. **Additional Providers**
   - Prometheus/metrics provider
   - Database query provider
   - gRPC provider
   - Custom webhook provider

2. **Advanced Features**
   - Verification dependencies (wait for other verifications)
   - Conditional metrics (skip based on conditions)
   - Notification hooks (on failure, on success)
   - Metric retries with backoff

3. **Observability**
   - Metrics exports (verification duration, success rates)
   - Distributed tracing integration
   - Structured logging improvements

4. **Optimization**
   - Batch store operations
   - Configurable measurement buffer
   - Dynamic interval adjustment based on success rate
