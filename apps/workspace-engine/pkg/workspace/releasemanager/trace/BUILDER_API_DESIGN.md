# Builder Pattern API Design

Pure builder-pattern API for execution trace recording with phase-specific methods and long-running objects.

## Design Principles

- **No Context**: Pure builder pattern without `context.Context` in public API
- **Phase-Specific Methods**: Planning and Eligibility phases have unique domain methods
- **Long-Running Objects**: Evaluations and checks have lifecycle with metadata and results
- **General-Purpose Actions**: Actions (e.g. verification, rollback) use flexible step-based model
- **External via CLI**: External systems record traces via ctrlplane CLI wrapper commands only

## API Overview

### Object Hierarchy

```text
ReconcileTarget
│
├─ PlanningPhase
│  ├─ Evaluation (long-running)
│  │  ├─ AddMetadata(key, value)
│  │  ├─ SetResult(result, message)
│  │  └─ End()
│  └─ MakeDecision(message, decision)
│
├─ EligibilityPhase
│  ├─ Check (long-running)
│  │  ├─ AddMetadata(key, value)
│  │  ├─ SetResult(result, message)
│  │  └─ End()
│  └─ MakeDecision(message, decision)
│
├─ ExecutionPhase
│  └─ Job
│     ├─ AddMetadata(key, value)
│     ├─ Token() string
│     └─ End()
│
└─ Action (general-purpose, e.g. verification, rollback, etc.)
   ├─ AddMetadata(key, value)
   ├─ AddStep(name, result, message)
   └─ End()
```

## Core API Examples

### 1. Create ReconcileTarget

```go
package releasemanager

import "github.com/ctrlplane/pkg/workspace/releasemanager/trace"

func ReconcileRelease(workspaceID, releaseTargetKey string) error {
    // Create trace recorder for this reconciliation
    rt := trace.NewReconcileTarget(workspaceID, releaseTargetKey)
    defer rt.Persist(store)

    // Continue with phases...
}
```

### 2. Planning Phase

```go
// Start planning phase
planning := rt.StartPlanning()

// Evaluate approval policy
eval := planning.StartEvaluation("Approval Policy")
eval.AddMetadata("policy_type", "approval")
eval.AddMetadata("policy_name", "production-deployment-approval")
eval.AddMetadata("approvers", []string{"alice@company.com", "bob@company.com"})
eval.AddMetadata("required_approvals", 1)
eval.SetResult(trace.ResultAllowed, "Policy approved by alice@company.com")
eval.End()

// Evaluate concurrency policy
concurrency := planning.StartEvaluation("Concurrency Policy")
concurrency.AddMetadata("policy_type", "concurrency")
concurrency.AddMetadata("current_deployments", 2)
concurrency.AddMetadata("max_concurrent", 5)
concurrency.AddMetadata("scope", "workspace")
concurrency.SetResult(trace.ResultAllowed, "Within limits: 2/5 concurrent deployments")
concurrency.End()

// Evaluate time window policy
timeWindow := planning.StartEvaluation("Time Window Policy")
timeWindow.AddMetadata("policy_type", "time_window")
timeWindow.AddMetadata("allowed_hours", "09:00-17:00")
timeWindow.AddMetadata("current_time", "14:30")
timeWindow.SetResult(trace.ResultAllowed, "Within deployment window")
timeWindow.End()

// Make final planning decision
planning.MakeDecision("Deploy approved", trace.DecisionApproved)
planning.End()
```

### 3. Eligibility Phase

```go
// Start eligibility phase
eligibility := rt.StartEligibility()

// Check if already deployed
alreadyDeployed := eligibility.StartCheck("Already Deployed")
alreadyDeployed.AddMetadata("target_version", "v1.2.3")
alreadyDeployed.AddMetadata("current_version", "v1.2.2")
alreadyDeployed.AddMetadata("release_target", "api-service-production")
alreadyDeployed.SetResult(trace.ResultPass, "Version v1.2.3 not deployed to target")
alreadyDeployed.End()

// Check failure count
failureCount := eligibility.StartCheck("Failure Count")
failureCount.AddMetadata("recent_failures", 0)
failureCount.AddMetadata("failure_threshold", 3)
failureCount.AddMetadata("time_window", "24h")
failureCount.SetResult(trace.ResultPass, "No recent failures in last 24h")
failureCount.End()

// Check deployment lock
deploymentLock := eligibility.StartCheck("Deployment Lock")
deploymentLock.AddMetadata("lock_status", "unlocked")
deploymentLock.AddMetadata("lock_reason", "")
deploymentLock.SetResult(trace.ResultPass, "Target is not locked")
deploymentLock.End()

// Make eligibility decision
eligibility.MakeDecision("Target eligible for deployment", trace.DecisionApproved)
eligibility.End()
```

### 4. Execution Phase

```go
// Start execution phase
execution := rt.StartExecution()

// Trigger GitHub Action job
job := execution.TriggerJob("github-action", map[string]string{
    "workflow":   "deploy.yml",
    "ref":        "main",
    "repository": "company/api-service",
})

// Add job metadata
job.AddMetadata("github_run_id", "8765432109")
job.AddMetadata("github_url", "https://github.com/company/api-service/actions/runs/8765432109")
job.AddMetadata("workflow_file", ".github/workflows/deploy.yml")
job.AddMetadata("triggered_at", time.Now())

// Generate token for external system to append to trace
token := job.Token()
// Token is automatically generated with 24h expiration
// Pass this to GitHub Action via workflow_dispatch input or secret

// Token format: base64(traceID:jobID:expiresAt).signature
// Example: eyJ0cmFjZUlEIjoiYWJjMTIzIiwiam9iSUQiOiJqb2ItNDU2IiwiZXhwaXJlc0F0IjoxNzA...

job.End()

execution.End()
```

### 5. Actions (Verification, Rollback, etc.)

Actions are general-purpose operations that can be performed at any point. Verification is implemented as actions with steps.

```go
// Start verification action (after job completes)
verification := rt.StartAction("Verification")

// Check pod readiness
verification.AddStep("Wait for pods", trace.ResultPass, "3/3 pods ready")
verification.AddMetadata("namespace", "production")
verification.AddMetadata("deployment", "api-service")
verification.AddMetadata("ready_replicas", 3)

// Check endpoint health
verification.AddStep("Check endpoints", trace.ResultPass, "200 OK in 45ms")
verification.AddMetadata("endpoint", "https://api.company.com/health")
verification.AddMetadata("response_time_ms", 45)

// Check metrics
verification.AddStep("Check metrics", trace.ResultPass, "Healthy")
verification.AddMetadata("error_rate", 0.0)
verification.AddMetadata("latency_p95_ms", 120)

// External smoke tests can be triggered separately via CLI
// with their own trace token - see section 3

verification.End()

// Actions can also be used for other operations like rollback
if deploymentFailed {
    rollback := rt.StartAction("Rollback")
    rollback.AddStep("Revert deployment", trace.ResultPass, "Rolled back to v1.2.2")
    rollback.AddStep("Verify rollback", trace.ResultPass, "Previous version healthy")
    rollback.End()
}

// Database migrations as action
migration := rt.StartAction("Database Migration")
migration.AddMetadata("migration_version", "20240115_add_indexes")
migration.AddStep("Backup database", trace.ResultPass, "Backup created")
migration.AddStep("Run migrations", trace.ResultPass, "12 migrations applied")
migration.AddStep("Verify schema", trace.ResultPass, "Schema valid")
migration.End()

// Cleanup as action
cleanup := rt.StartAction("Cleanup Old Resources")
cleanup.AddStep("Remove old pods", trace.ResultPass, "5 pods deleted")
cleanup.AddStep("Prune images", trace.ResultPass, "2.3GB freed")
cleanup.AddStep("Clear cache", trace.ResultPass, "Cache cleared")
cleanup.End()
```

### 6. Complete and Persist

```go
// Mark entire reconciliation as complete
rt.Complete(trace.StatusCompleted)

// Persist all spans to storage
if err := rt.Persist(store); err != nil {
    return fmt.Errorf("failed to persist trace: %w", err)
}
```

## External System Recording

### CLI Wrapper Commands

External systems (GitHub Actions, Jenkins, CLI tools) use the ctrlplane CLI to record trace events.

#### CLI Command Structure

```bash
# Start a new action in the trace
ctrlplane trace start <action-name>

# Record a completed step
ctrlplane trace step <step-name> <status> [message]

# End the current action
ctrlplane trace end <status> [message]

# Add metadata to current action/step
ctrlplane trace metadata <key> <value>
```

#### Environment Setup

```bash
# Set trace token (provided by workspace-engine when job is triggered)
export CTRLPLANE_TRACE_TOKEN="eyJ0cmFjZUlEIjoiYWJjMTIzIiwiam9i..."

# Optionally set API endpoint if not using default
export CTRLPLANE_API_URL="https://ctrlplane.company.com"
```

### GitHub Action Example

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  workflow_dispatch:
    inputs:
      trace_token:
        description: "Ctrlplane trace token for linking execution"
        required: true
      version:
        description: "Version to deploy"
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest

    env:
      CTRLPLANE_TRACE_TOKEN: ${{ inputs.trace_token }}

    steps:
      - name: Checkout code
        run: |
          ctrlplane trace start "Deploy via GitHub Action"

          git checkout ${{ inputs.version }}
          ctrlplane trace step "Checkout code" "completed" "Checked out ${{ inputs.version }}"

      - name: Build Docker image
        run: |
          docker build -t api-service:${{ inputs.version }} .
          ctrlplane trace step "Build docker image" "completed" "Built api-service:${{ inputs.version }}"

      - name: Push to registry
        run: |
          docker push registry.company.com/api-service:${{ inputs.version }}
          ctrlplane trace step "Push to registry" "completed" "Pushed to registry"

      - name: Deploy to Kubernetes
        run: |
          ctrlplane trace start "Apply to Kubernetes"

          kubectl apply -f k8s/deployment.yaml
          ctrlplane trace step "Apply deployment.yaml" "completed"

          kubectl apply -f k8s/service.yaml
          ctrlplane trace step "Apply service.yaml" "completed"

          kubectl apply -f k8s/ingress.yaml
          ctrlplane trace step "Apply ingress.yaml" "completed"

          ctrlplane trace end "completed" "Kubernetes resources applied"

      - name: Finalize
        if: always()
        run: |
          ctrlplane trace end "completed" "Deployment finished"
```

### Jenkins Pipeline Example

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        CTRLPLANE_TRACE_TOKEN = credentials('ctrlplane-trace-token')
    }

    stages {
        stage('Smoke Tests') {
            steps {
                sh '''
                    ctrlplane trace start "External Smoke Tests"

                    # Authentication test
                    if curl -f https://api.company.com/auth/test; then
                        ctrlplane trace step "Test authentication" "completed" "Auth successful"
                    else
                        ctrlplane trace step "Test authentication" "failed" "Auth failed"
                        exit 1
                    fi

                    # Core API test
                    if curl -f https://api.company.com/api/v1/health; then
                        ctrlplane trace step "Test core API" "completed" "API responding"
                    else
                        ctrlplane trace step "Test core API" "failed" "API not responding"
                        exit 1
                    fi

                    # Database test
                    if curl -f https://api.company.com/api/v1/db-health; then
                        ctrlplane trace step "Test database connection" "completed" "DB connected"
                    else
                        ctrlplane trace step "Test database connection" "failed" "DB connection failed"
                        exit 1
                    fi

                    ctrlplane trace end "completed" "All smoke tests passed"
                '''
            }
        }
    }
}
```

### CLI Implementation Concept

```go
// pkg/cli/trace/trace.go
package trace

import (
    "fmt"
    "os"

    "github.com/ctrlplane/pkg/workspace/releasemanager/trace"
)

// CLITracer manages trace recording from CLI
type CLITracer struct {
    token    string
    recorder *trace.ExternalRecorder

    // Stack for nested actions
    actionStack []string
}

// NewCLITracer creates a tracer from environment token
func NewCLITracer() (*CLITracer, error) {
    token := os.Getenv("CTRLPLANE_TRACE_TOKEN")
    if token == "" {
        return nil, fmt.Errorf("CTRLPLANE_TRACE_TOKEN not set")
    }

    recorder, err := trace.NewExternalRecorder(token)
    if err != nil {
        return nil, fmt.Errorf("invalid trace token: %w", err)
    }

    return &CLITracer{
        token:       token,
        recorder:    recorder,
        actionStack: make([]string, 0),
    }, nil
}

// Start begins a new action (pushes to stack)
func (c *CLITracer) Start(name string) error {
    action := c.recorder.StartAction(name)
    c.actionStack = append(c.actionStack, action.ID())
    return nil
}

// Step records an immediate step on the current action
func (c *CLITracer) Step(name, status, message string) error {
    if len(c.actionStack) == 0 {
        return fmt.Errorf("no active action - call 'trace start' first")
    }

    currentActionID := c.actionStack[len(c.actionStack)-1]
    action := c.recorder.GetAction(currentActionID)
    action.RecordStep(name, trace.Status(status), message)
    return nil
}

// End completes the current action (pops from stack)
func (c *CLITracer) End(status, message string) error {
    if len(c.actionStack) == 0 {
        return fmt.Errorf("no active action to end")
    }

    currentActionID := c.actionStack[len(c.actionStack)-1]
    action := c.recorder.GetAction(currentActionID)
    action.End(trace.Status(status), message)

    // Pop from stack
    c.actionStack = c.actionStack[:len(c.actionStack)-1]

    // If stack is empty, flush spans to API
    if len(c.actionStack) == 0 {
        return c.recorder.Flush()
    }

    return nil
}

// Metadata adds metadata to the current action
func (c *CLITracer) Metadata(key string, value interface{}) error {
    if len(c.actionStack) == 0 {
        return fmt.Errorf("no active action")
    }

    currentActionID := c.actionStack[len(c.actionStack)-1]
    action := c.recorder.GetAction(currentActionID)
    action.AddMetadata(key, value)
    return nil
}
```

## Complete Example Flow

### Full api-service Deployment

```go
package releasemanager

import (
    "fmt"
    "time"

    "github.com/ctrlplane/pkg/workspace/releasemanager/trace"
)

func DeployAPIService(
    workspaceID string,
    releaseTargetKey string,
    version string,
    store trace.PersistenceStore,
) error {
    // 1. Create reconciliation trace
    rt := trace.NewReconcileTarget(workspaceID, releaseTargetKey)
    defer func() {
        if err := rt.Persist(store); err != nil {
            fmt.Printf("Warning: failed to persist trace: %v\n", err)
        }
    }()

    // 2. PLANNING PHASE
    planning := rt.StartPlanning()

    // Approval policy
    approval := planning.StartEvaluation("Approval Policy")
    approval.AddMetadata("policy_type", "approval")
    approval.AddMetadata("required_approvals", 1)
    approval.AddMetadata("approver", "alice@company.com")
    approval.SetResult(trace.ResultAllowed, "Approved by alice@company.com")
    approval.End()

    // Concurrency policy
    concurrency := planning.StartEvaluation("Concurrency Policy")
    concurrency.AddMetadata("current_deployments", 2)
    concurrency.AddMetadata("max_concurrent", 5)
    concurrency.SetResult(trace.ResultAllowed, "Within limits: 2/5")
    concurrency.End()

    planning.MakeDecision("Deploy approved", trace.DecisionApproved)
    planning.End()

    // 3. ELIGIBILITY PHASE
    eligibility := rt.StartEligibility()

    // Already deployed check
    deployed := eligibility.StartCheck("Already Deployed")
    deployed.AddMetadata("target_version", version)
    deployed.AddMetadata("current_version", "v1.2.2")
    deployed.SetResult(trace.ResultPass, fmt.Sprintf("%s not deployed", version))
    deployed.End()

    // Failure count check
    failures := eligibility.StartCheck("Failure Count")
    failures.AddMetadata("recent_failures", 0)
    failures.AddMetadata("threshold", 3)
    failures.SetResult(trace.ResultPass, "No recent failures")
    failures.End()

    eligibility.MakeDecision("Target eligible", trace.DecisionApproved)
    eligibility.End()

    // 4. EXECUTION PHASE
    execution := rt.StartExecution()

    // Trigger GitHub Action
    job := execution.TriggerJob("github-action", map[string]string{
        "workflow":   "deploy.yml",
        "ref":        "main",
        "version":    version,
    })
    job.AddMetadata("github_run_id", "8765432109")
    job.AddMetadata("github_url", "https://github.com/company/api-service/actions/runs/8765432109")

    // Get trace token for GitHub Action
    token := job.Token()

    // In real implementation, this would:
    // 1. Trigger GitHub workflow_dispatch with token as input
    // 2. GitHub Action uses token to record deployment steps
    // 3. Wait for GitHub Action to complete

    job.End()
    execution.End()

    // GitHub Action runs here (externally) using the token
    // See "GitHub Action Example" section above for what happens externally

    // 5. VERIFICATION (after GitHub Action completes)
    verification := rt.StartAction("Verification")

    // Add verification steps
    verification.AddMetadata("namespace", "production")
    verification.AddMetadata("deployment", "api-service")

    verification.AddStep("Wait for pods", trace.ResultPass, "3/3 pods ready")
    verification.AddStep("Check endpoints", trace.ResultPass, "200 OK")
    verification.AddStep("Check metrics", trace.ResultPass, "Error rate: 0%, p95: 120ms")

    // External smoke tests would be triggered here via Jenkins/CLI
    // with their own trace token - they append to the same trace

    verification.End()

    // 6. Complete reconciliation
    rt.Complete(trace.StatusCompleted)

    return nil
}
```

### Resulting Trace Hierarchy

```text
Reconcile: api-service (v1.2.3 → production)
│
├─ Planning [2.3s]
│  ├─ Evaluation: Approval Policy [0.5s] ✓ allowed
│  ├─ Evaluation: Concurrency Policy [0.3s] ✓ allowed
│  └─ Decision: Deploy approved ✓
│
├─ Eligibility [1.1s]
│  ├─ Check: Already Deployed [0.4s] ✓ pass
│  ├─ Check: Failure Count [0.3s] ✓ pass
│  └─ Decision: Target eligible ✓
│
├─ Execution [3m 45s]
│  └─ Job: github-action [3m 45s]
│     └─ (Token generated for external recording)
│
├─ External Execution [GitHub Action - 3m 30s]
│  └─ Action: Deploy via GitHub Action
│     ├─ Step: Checkout code [5s] ✓
│     ├─ Step: Build docker image [1m 20s] ✓
│     ├─ Step: Push to registry [45s] ✓
│     └─ Action: Apply to Kubernetes [1m 20s]
│        ├─ Step: Apply deployment.yaml [25s] ✓
│        ├─ Step: Apply service.yaml [10s] ✓
│        └─ Step: Apply ingress.yaml [15s] ✓
│
├─ Action: Verification [12s]
│  ├─ Step: Wait for pods [4s] ✓ pass
│  ├─ Step: Check endpoints [3s] ✓ pass
│  └─ Step: Check metrics [2s] ✓ pass
│
└─ Action: External Smoke Tests [Jenkins - 45s]
   ├─ Step: Test authentication [15s] ✓
   ├─ Step: Test core API [12s] ✓
   └─ Step: Test database connection [8s] ✓
```

## Type Reference

### ReconcileTarget

Main entry point for trace recording.

```go
type ReconcileTarget interface {
    // Phase starters
    StartPlanning() *PlanningPhase
    StartEligibility() *EligibilityPhase
    StartExecution() *ExecutionPhase

    // General-purpose action (for verification, rollback, etc.)
    StartAction(name string) *Action

    // Lifecycle
    Complete(status Status)

    // Persistence - can take store as argument, or use store configured at creation
    Persist(store ...PersistenceStore) error
}

// Constructor without persistence config (provide store at persist time)
func NewReconcileTarget(workspaceID, releaseTargetKey string) *ReconcileTarget

// Constructor with persistence config (can call Persist() without arguments)
func NewReconcileTargetWithStore(workspaceID, releaseTargetKey string, store PersistenceStore) *ReconcileTarget
```

### PlanningPhase

Phase for policy evaluations and deployment decisions.

```go
type PlanningPhase interface {
    // Start a new policy evaluation
    StartEvaluation(name string) *Evaluation

    // Make the final planning decision
    MakeDecision(message string, decision Decision)

    // End the planning phase
    End()
}
```

### Evaluation

Long-running policy evaluation object.

```go
type Evaluation interface {
    // Add metadata about the evaluation
    AddMetadata(key string, value interface{}) *Evaluation

    // Set the evaluation result
    SetResult(result EvaluationResult, message string) *Evaluation

    // End the evaluation
    End()
}
```

### EligibilityPhase

Phase for checking if target is eligible for deployment.

```go
type EligibilityPhase interface {
    // Start an eligibility check
    StartCheck(name string) *Check

    // Make the final eligibility decision
    MakeDecision(message string, decision Decision)

    // End the eligibility phase
    End()
}
```

### Check

Long-running eligibility check object.

```go
type Check interface {
    // Add metadata about the check
    AddMetadata(key string, value interface{}) *Check

    // Set the check result
    SetResult(result CheckResult, message string) *Check

    // End the check
    End()
}
```

### ExecutionPhase

Phase for triggering deployment jobs.

```go
type ExecutionPhase interface {
    // Trigger a deployment job
    TriggerJob(jobType string, config map[string]string) *Job

    // End the execution phase
    End()
}
```

### Job

Represents a triggered deployment job.

```go
type Job interface {
    // Add metadata about the job
    AddMetadata(key string, value interface{}) *Job

    // Get trace token for external system to append events
    Token() string

    // End the job (locally - external execution continues)
    End()
}
```

### Action

General-purpose action for verification, rollback, or other operations.

```go
type Action interface {
    // Add metadata about the action
    AddMetadata(key string, value interface{}) *Action

    // Add a step to the action (immediate - completes when called)
    AddStep(name string, result StepResult, message string) *Action

    // End the action
    End()
}
```

### PersistenceStore

Interface for storing trace spans. This is passed when creating a ReconcileTarget or can be provided later at persist time.

```go
type PersistenceStore interface {
    // WriteSpans persists a batch of spans to storage
    // Spans are provided as OTel ReadOnlySpan objects
    WriteSpans(ctx context.Context, spans []ReadOnlySpan) error
}

// ReadOnlySpan is the OTel span interface
type ReadOnlySpan interface {
    Name() string
    SpanContext() SpanContext
    Parent() SpanContext
    StartTime() time.Time
    EndTime() time.Time
    Attributes() []attribute.KeyValue
    Events() []Event
    Status() Status
    // ... other OTel span methods
}
```

## Persistence Configuration

### Overview

Traces are stored using a pluggable persistence layer. The system accumulates spans in memory during trace recording and writes them to the configured store when `rt.Persist()` is called.

### Creating ReconcileTarget with Persistence

You can either pass persistence configuration at creation or provide it later.

#### Option 1: Configure at Creation

```go
// Create with persistence config
store := NewDatabaseStore(db)
rt := trace.NewReconcileTargetWithStore(workspaceID, releaseTargetKey, store)

// Later, just call Persist without arguments
rt.Complete(trace.StatusCompleted)
rt.Persist() // Uses store configured at creation
```

#### Option 2: Provide at Persist Time

```go
// Create without persistence config
rt := trace.NewReconcileTarget(workspaceID, releaseTargetKey)

// Provide store when persisting
rt.Complete(trace.StatusCompleted)
store := NewDatabaseStore(db)
rt.Persist(store)
```

### How Persistence Works

#### 1. Span Accumulation

During trace recording, spans are created and stored in memory via OpenTelemetry's in-memory exporter:

```go
rt := trace.NewReconcileTarget(workspaceID, releaseTargetKey)

planning := rt.StartPlanning()
// Creates a span in memory, not yet persisted
eval := planning.StartEvaluation("Approval Policy")
// Creates another span in memory
eval.End()
// Span is completed but still in memory

planning.End()
// Phase span completed, still in memory
```

#### 2. Batch Persistence

When `rt.Persist(store)` is called, all accumulated spans are written to storage in a single batch:

```go
rt.Complete(trace.StatusCompleted)
// Completes root span, all spans now in memory

err := rt.Persist(store)
// Writes ALL spans to storage in one batch
// - More efficient than writing spans individually
// - Maintains consistency (all-or-nothing)
// - Reduces database/API round trips
```

#### 3. Automatic Persistence with Defer

Use defer for automatic persistence on function exit:

```go
func ReconcileRelease(workspaceID, releaseTargetKey string, store trace.PersistenceStore) error {
    rt := trace.NewReconcileTarget(workspaceID, releaseTargetKey)

    // Ensure spans are persisted even if function panics or returns early
    defer func() {
        rt.Complete(trace.StatusCompleted)
        if err := rt.Persist(store); err != nil {
            log.Printf("Failed to persist trace: %v", err)
        }
    }()

    // Do work...
    planning := rt.StartPlanning()
    // ...

    return nil
}
```

### Persistence Store Implementations

#### Database Store

Writes spans directly to a database table.

```go
type DatabaseStore struct {
    db *sql.DB
}

func NewDatabaseStore(db *sql.DB) *DatabaseStore {
    return &DatabaseStore{db: db}
}

func (s *DatabaseStore) WriteSpans(ctx context.Context, spans []trace.ReadOnlySpan) error {
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return err
    }
    defer tx.Rollback()

    for _, span := range spans {
        // Extract span data
        traceID := span.SpanContext().TraceID().String()
        spanID := span.SpanContext().SpanID().String()
        parentID := ""
        if span.Parent().IsValid() {
            parentID = span.Parent().SpanID().String()
        }

        // Extract custom attributes
        var phase, nodeType, status, jobID, releaseID string
        for _, attr := range span.Attributes() {
            switch attr.Key {
            case "ctrlplane.phase":
                phase = attr.Value.AsString()
            case "ctrlplane.node_type":
                nodeType = attr.Value.AsString()
            case "ctrlplane.status":
                status = attr.Value.AsString()
            case "ctrlplane.job_id":
                jobID = attr.Value.AsString()
            case "ctrlplane.release_id":
                releaseID = attr.Value.AsString()
            }
        }

        // Insert span
        _, err := tx.ExecContext(ctx, `
            INSERT INTO trace_spans (
                trace_id, span_id, parent_span_id, name,
                phase, node_type, status,
                job_id, release_id,
                start_time, end_time,
                attributes, events
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
            traceID, spanID, parentID, span.Name(),
            phase, nodeType, status,
            jobID, releaseID,
            span.StartTime(), span.EndTime(),
            serializeAttributes(span.Attributes()),
            serializeEvents(span.Events()),
        )

        if err != nil {
            return fmt.Errorf("failed to insert span: %w", err)
        }
    }

    return tx.Commit()
}
```

#### API Store (for External Systems)

External systems (CLI, GitHub Actions) send spans back to ctrlplane API.

```go
type APIStore struct {
    apiURL string
    apiKey string
    client *http.Client
}

func NewAPIStore(apiURL, apiKey string) *APIStore {
    return &APIStore{
        apiURL: apiURL,
        apiKey: apiKey,
        client: &http.Client{Timeout: 30 * time.Second},
    }
}

func (s *APIStore) WriteSpans(ctx context.Context, spans []trace.ReadOnlySpan) error {
    // Convert spans to JSON payload
    payload := spansToJSON(spans)

    // POST to ctrlplane API
    req, err := http.NewRequestWithContext(
        ctx,
        "POST",
        s.apiURL+"/api/traces/spans",
        bytes.NewReader(payload),
    )
    if err != nil {
        return err
    }

    req.Header.Set("Authorization", "Bearer "+s.apiKey)
    req.Header.Set("Content-Type", "application/json")

    resp, err := s.client.Do(req)
    if err != nil {
        return fmt.Errorf("failed to send spans to API: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        body, _ := io.ReadAll(resp.Body)
        return fmt.Errorf("API returned error %d: %s", resp.StatusCode, body)
    }

    return nil
}

func spansToJSON(spans []trace.ReadOnlySpan) []byte {
    // Convert OTel spans to JSON format
    // Include all attributes, events, and timing information
    // Format should match what the ctrlplane API expects
    // ...
}
```

#### Multi-Store (Write to Multiple Destinations)

```go
type MultiStore struct {
    stores []trace.PersistenceStore
}

func NewMultiStore(stores ...trace.PersistenceStore) *MultiStore {
    return &MultiStore{stores: stores}
}

func (s *MultiStore) WriteSpans(ctx context.Context, spans []trace.ReadOnlySpan) error {
    var errs []error

    for _, store := range s.stores {
        if err := store.WriteSpans(ctx, spans); err != nil {
            errs = append(errs, err)
        }
    }

    if len(errs) > 0 {
        return fmt.Errorf("failed to write to %d stores: %v", len(errs), errs)
    }

    return nil
}

// Usage: Write to both database and external OTel collector
store := trace.NewMultiStore(
    trace.NewDatabaseStore(db),
    trace.NewOTelCollectorStore("http://otel-collector:4318"),
)
rt := trace.NewReconcileTargetWithStore(workspaceID, releaseTargetKey, store)
```

### Persistence Timing

#### Internal Traces (Workspace Engine)

```go
func ReconcileRelease(...) error {
    rt := trace.NewReconcileTarget(workspaceID, releaseTargetKey)
    defer func() {
        rt.Complete(trace.StatusCompleted)
        rt.Persist(store) // Persist when reconciliation completes
    }()

    // Do reconciliation work...
    // All spans accumulate in memory

    return nil
}
// On function exit, defer runs and persists all spans
```

#### External Traces (CLI/GitHub Actions)

External systems persist after their action completes:

```bash
# In GitHub Action
ctrlplane trace start "Deploy"
ctrlplane trace step "Build" "completed"
ctrlplane trace step "Push" "completed"
ctrlplane trace end "completed"

# CLI automatically persists when trace ends
# Sends all spans to API in one batch
```

CLI implementation:

```go
func (c *CLITracer) End(status, message string) error {
    // ... end current action ...

    // If stack is empty, flush all spans to API
    if len(c.actionStack) == 0 {
        return c.recorder.Flush() // Calls Persist internally
    }

    return nil
}
```

### Database Schema Example

```sql
CREATE TABLE trace_spans (
    id BIGSERIAL PRIMARY KEY,

    -- OTel identifiers
    trace_id VARCHAR(32) NOT NULL,
    span_id VARCHAR(16) NOT NULL,
    parent_span_id VARCHAR(16),

    -- Span data
    name TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,

    -- Ctrlplane-specific attributes
    phase VARCHAR(50),
    node_type VARCHAR(50),
    status VARCHAR(50),

    -- Context linking
    workspace_id VARCHAR(255),
    release_target_key VARCHAR(255),
    release_id VARCHAR(255),
    job_id VARCHAR(255),
    parent_trace_id VARCHAR(32), -- Links external traces to parent

    -- Additional data
    attributes JSONB, -- All span attributes
    events JSONB, -- Span events (metadata, results)

    -- Indexing
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(trace_id, span_id)
);

-- Indexes for efficient querying
CREATE INDEX idx_trace_spans_trace_id ON trace_spans(trace_id);
CREATE INDEX idx_trace_spans_parent ON trace_spans(parent_span_id);
CREATE INDEX idx_trace_spans_job_id ON trace_spans(job_id);
CREATE INDEX idx_trace_spans_release_target ON trace_spans(release_target_key);
CREATE INDEX idx_trace_spans_parent_trace ON trace_spans(parent_trace_id);
CREATE INDEX idx_trace_spans_created_at ON trace_spans(created_at);
```

### Linking External Traces

External traces include `parent_trace_id` to link back to the reconciliation trace:

```go
// In workspace engine
job := execution.TriggerJob("github-action", config)
token := job.Token() // Token contains trace ID

// Later, in GitHub Action using CLI
// CLI extracts trace ID from token and sets parent_trace_id attribute
recorder, _ := trace.NewExternalRecorder(token)
// All spans from this recorder will have parent_trace_id set

// When persisted to database, spans have parent_trace_id
// UI can query: SELECT * FROM trace_spans WHERE parent_trace_id = '<reconciliation-trace-id>'
// This retrieves both internal and external spans
```

### Error Handling

```go
func (s *DatabaseStore) WriteSpans(ctx context.Context, spans []trace.ReadOnlySpan) error {
    // Use transaction for atomicity
    tx, err := s.db.BeginTx(ctx, nil)
    if err != nil {
        return fmt.Errorf("failed to begin transaction: %w", err)
    }
    defer tx.Rollback()

    for _, span := range spans {
        if err := s.writeSpan(tx, span); err != nil {
            // Transaction will rollback on return
            return fmt.Errorf("failed to write span %s: %w", span.SpanContext().SpanID(), err)
        }
    }

    // Commit all spans atomically
    if err := tx.Commit(); err != nil {
        return fmt.Errorf("failed to commit spans: %w", err)
    }

    return nil
}
```

### Persistence Best Practices

1. **Use Defer**: Always use defer to ensure traces are persisted even on early returns or panics
2. **Batch Writes**: Write all spans in a single batch for efficiency
3. **Transactions**: Use database transactions for atomicity
4. **Error Logging**: Log persistence errors but don't fail the main operation
5. **Async Option**: For high-throughput scenarios, consider async persistence with a buffer
6. **Retry Logic**: Implement retries for transient failures (network issues, database contention)

```go
func (s *DatabaseStore) WriteSpans(ctx context.Context, spans []trace.ReadOnlySpan) error {
    const maxRetries = 3

    for i := 0; i < maxRetries; i++ {
        err := s.writeSpansWithTransaction(ctx, spans)
        if err == nil {
            return nil
        }

        // Check if error is retryable
        if !isRetryable(err) {
            return err
        }

        // Exponential backoff
        time.Sleep(time.Duration(1<<uint(i)) * 100 * time.Millisecond)
    }

    return fmt.Errorf("failed after %d retries", maxRetries)
}
```

## Result/Status Enums

### EvaluationResult

Results for policy evaluations.

```go
type EvaluationResult string

const (
    ResultAllowed EvaluationResult = "allowed" // Policy allows the action
    ResultBlocked EvaluationResult = "blocked" // Policy blocks the action
)
```

### CheckResult

Results for eligibility checks.

```go
type CheckResult string

const (
    ResultPass CheckResult = "pass" // Check passed
    ResultFail CheckResult = "fail" // Check failed
)
```

### StepResult

Results for action steps (verification, rollback, etc.).

```go
type StepResult string

const (
    ResultPass StepResult = "pass" // Step passed
    ResultFail StepResult = "fail" // Step failed
)
```

### Decision

Final decision outcomes.

```go
type Decision string

const (
    DecisionApproved Decision = "approved" // Action approved
    DecisionRejected Decision = "rejected" // Action rejected
)
```

### Status

Overall phase/reconciliation status.

```go
type Status string

const (
    StatusCompleted Status = "completed" // Successfully completed
    StatusFailed    Status = "failed"    // Failed
    StatusSkipped   Status = "skipped"   // Skipped
)
```

## API Design Decisions

These questions have been resolved and reflect the final API design.

### 1. Decision Handling

**Question**: Should `MakeDecision()` be automatic or explicit?

**Decision**: ✓ **Explicit** - User must call `phase.MakeDecision()` before `phase.End()`

**Rationale**: Makes trace clearer and allows for overriding automated decisions. Explicit decisions appear in the trace tree, providing better visibility into the deployment decision flow.

### 2. Phase Auto-End

**Question**: Should phases auto-end when the next phase starts?

**Decision**: ✓ **Manual** - User must call `phase.End()` before starting next phase

**Rationale**: Explicit is clearer and gives users full control over when phases complete. This prevents subtle bugs from implicit state changes and makes the trace lifecycle visible in code.

### 3. Error Handling

**Question**: How should errors be handled in the builder pattern?

**Decision**: ✓ **Collect errors internally** - Track errors internally, check at `rt.Complete()`

**Rationale**: Maintains fluent API while handling errors properly. Errors from trace recording should not fail the deployment itself. Persistence errors are returned from `rt.Persist()`.

**Implementation**:

```go
// Trace recording errors don't break the fluent API
rt := trace.NewReconcileTarget(workspaceID, releaseTargetKey)
planning := rt.StartPlanning()
eval := planning.StartEvaluation("Approval")
// ... no error checking needed during recording

// Check for persistence errors only
if err := rt.Persist(store); err != nil {
    log.Printf("Failed to persist trace: %v", err)
    // Deployment continues regardless
}
```

### 4. Job Step Recording

**Question**: Should `Job` have methods to record steps internally, or only external via token?

**Decision**: ✓ **External only** - Jobs can only add metadata, steps recorded via CLI/token

**Rationale**: Keeps clear boundary between internal and external execution. The workspace engine triggers jobs and hands off execution to external systems. External systems use the trace token to append their own steps. This separation prevents confusion about execution location and responsibility.

### 5. Naming Conventions

**Question**: Should we use `Start` prefix for long-running operations?

**Decision**: ✓ **Use `Start` prefix** - `StartEvaluation()`, `StartCheck()`, `StartAction()`

**Rationale**: Clearly indicates that a long-running operation is beginning, distinguishing from immediate operations like `MakeDecision()` or `AddStep()`. The `Start` prefix signals that you'll get an object back that needs to be `.End()`ed later, making the lifecycle explicit in the API.

### 6. Metadata Chaining

**Question**: Should metadata methods return `*Self` for chaining?

**Decision**: ✓ **Yes, enable chaining** - All metadata methods return self

**Rationale**: Common builder pattern that improves ergonomics. Allows both chained and non-chained styles depending on preference:

```go
// Chained style
eval.AddMetadata("policy", "approval")
    .AddMetadata("approver", "alice")
    .SetResult(trace.ResultAllowed, "Approved")

// Non-chained style (also valid)
eval.AddMetadata("policy", "approval")
eval.AddMetadata("approver", "alice")
eval.SetResult(trace.ResultAllowed, "Approved")
```

### 7. Phase Re-use

**Question**: Should you be able to run the same phase multiple times?

**Decision**: ✓ **No re-use** - Each phase runs once per reconciliation

**Rationale**: Keeps mental model simple and trace structure predictable. Each reconciliation has a clear linear flow: Planning → Eligibility → Execution → Actions. If you need to add more data after a phase, use a new Action instead. For verification that happens in multiple stages, use multiple Action calls:

```go
// First verification after deployment
verification1 := rt.StartAction("Immediate Verification")
verification1.AddStep("Check pods", trace.ResultPass, "3/3 ready")
verification1.End()

// Later verification after warmup
verification2 := rt.StartAction("Post-Warmup Verification")
verification2.AddStep("Check metrics", trace.ResultPass, "Stable")
verification2.End()
```

Note: There is no `StartVerification()` phase - verification uses the generic `StartAction()` function.

### 8. Token Expiration

**Question**: Should token expiration be configurable per job?

**Decision**: ✓ **Fixed 24h expiration** - `job.Token()` generates tokens valid for 24 hours

**Rationale**: Sufficient for most deployments. Keeps API simple. Most deployment workflows complete in minutes to hours, so 24h provides plenty of buffer. If specific use cases require custom expiration, it can be added later via `job.TokenWithExpiration(duration)` without breaking existing code.

### 9. Action Flexibility

**Question**: Should Actions have any special types or are they completely free-form?

**Decision**: ✓ **Free-form** - Actions are named containers for steps, completely flexible

**Rationale**: Maximum flexibility for users to implement their own patterns. Actions can represent any operation: verification, rollback, migration, cleanup, etc. The name is user-defined and appears in traces. Common patterns are documented as examples without enforcing types.

**Example use cases**:

```go
// Verification
verification := rt.StartAction("Verification")
verification.AddStep("Check pods", trace.ResultPass, "3/3 ready")

// Rollback
rollback := rt.StartAction("Rollback")
rollback.AddStep("Revert deployment", trace.ResultPass, "Rolled back")

// Migration
migration := rt.StartAction("Database Migration")
migration.AddStep("Run migrations", trace.ResultPass, "12 applied")

// Cleanup
cleanup := rt.StartAction("Cleanup Old Resources")
cleanup.AddStep("Remove old pods", trace.ResultPass, "5 deleted")
```

All use the same `StartAction()` API with different names and steps, keeping the implementation simple while supporting any workflow.

## Implementation Notes

### Architecture: OTel Foundation with Domain Wrappers

The trace recording system is built **directly on top of OpenTelemetry (OTel)**, not as a replacement. The builder API is a domain-specific facade that wraps OTel primitives.

#### Why OpenTelemetry?

- **Industry Standard**: OTel is the CNCF standard for observability
- **Tooling Ecosystem**: Integrates with existing OTel collectors, exporters, and visualization tools
- **Proven Performance**: Battle-tested span processing and memory management
- **Interoperability**: Can export to Jaeger, Prometheus, Grafana, Datadog, etc.

#### How the Wrapper Works

```text
User Code (Builder API)
        ↓
Domain-Specific Wrappers (Planning, Eligibility, Execution, Action)
        ↓
OTel Tracer & Spans (trace.Tracer, trace.Span)
        ↓
OTel SDK (TracerProvider, SpanProcessor, Exporter)
        ↓
Storage (Database, API, OTel Collector)
```

**Key Point**: Every operation in the builder API creates or modifies an actual OpenTelemetry span. There are no custom trace data structures—just OTel spans with ctrlplane-specific attributes.

#### Mapping Builder API to OTel Concepts

| Builder API         | OTel Primitive                     | Description                                              |
| ------------------- | ---------------------------------- | -------------------------------------------------------- |
| `ReconcileTarget`   | `trace.Tracer` + root `trace.Span` | Tracer instance with root span for reconciliation        |
| `StartPlanning()`   | `tracer.Start(ctx, "Planning")`    | Creates child span with `ctrlplane.phase=planning`       |
| `StartEvaluation()` | `tracer.Start(ctx, name)`          | Creates child span with `ctrlplane.node_type=evaluation` |
| `AddMetadata()`     | `span.AddEvent()`                  | Adds OTel span event with attributes                     |
| `SetResult()`       | `span.SetAttributes()`             | Sets attributes like `ctrlplane.status=allowed`          |
| `End()`             | `span.End()`                       | Ends the span with appropriate OTel status code          |
| `Persist()`         | `exporter.ExportSpans()`           | Flushes spans from in-memory exporter to storage         |

#### Domain-Specific Attributes

Ctrlplane adds custom attributes to OTel spans using the `ctrlplane.*` namespace:

```go
span.SetAttributes(
    attribute.String("ctrlplane.phase", "planning"),              // Phase type
    attribute.String("ctrlplane.node_type", "evaluation"),       // Node type
    attribute.String("ctrlplane.status", "allowed"),             // Domain status
    attribute.String("ctrlplane.job_id", "job-123"),             // Job linking
    attribute.String("ctrlplane.release_id", "rel-456"),         // Release linking
    attribute.String("ctrlplane.parent_trace_id", "abc..."),     // External trace linking
    attribute.Int("ctrlplane.depth", 2),                         // Tree depth
    attribute.Int("ctrlplane.sequence", 5),                      // Execution order
)
```

These attributes make OTel spans queryable by deployment-specific concepts while remaining compatible with standard OTel tooling.

#### Benefits of This Approach

1. **Standard Format**: Spans are stored in OTel format, readable by any OTel-compatible tool
2. **Future-Proof**: Can easily export to new OTel-compatible systems
3. **No Reinventing**: Leverages OTel's span lifecycle, context propagation, and performance
4. **Dual Use**: Same data serves both ctrlplane UI and external observability tools
5. **Debugging**: Can view traces in Jaeger/Grafana during development

#### Example: What Actually Happens

When you write this:

```go
rt := trace.NewReconcileTarget(workspaceID, releaseTargetKey)
planning := rt.StartPlanning()
eval := planning.StartEvaluation("Approval Policy")
eval.AddMetadata("approver", "alice")
eval.SetResult(trace.ResultAllowed, "Approved")
eval.End()
```

Internally, this happens:

```go
// NewReconcileTarget
tracerProvider := sdktrace.NewTracerProvider(sdktrace.WithSyncer(inMemoryExporter))
tracer := tracerProvider.Tracer("ctrlplane.trace")
rootCtx, rootSpan := tracer.Start(context.Background(), "Reconciliation",
    trace.WithAttributes(
        attribute.String("ctrlplane.phase", "reconciliation"),
        attribute.String("ctrlplane.node_type", "phase"),
    ))

// StartPlanning
planningCtx, planningSpan := tracer.Start(rootCtx, "Planning",
    trace.WithAttributes(
        attribute.String("ctrlplane.phase", "planning"),
        attribute.String("ctrlplane.node_type", "phase"),
    ))

// StartEvaluation
evalCtx, evalSpan := tracer.Start(planningCtx, "Approval Policy",
    trace.WithAttributes(
        attribute.String("ctrlplane.phase", "planning"),
        attribute.String("ctrlplane.node_type", "evaluation"),
        attribute.String("ctrlplane.status", "running"),
    ))

// AddMetadata
evalSpan.AddEvent("approver", trace.WithAttributes(
    attribute.String("approver", "alice"),
))

// SetResult
evalSpan.SetAttributes(
    attribute.String("ctrlplane.status", "allowed"),
)
evalSpan.SetStatus(codes.Ok, "Approved")

// End
evalSpan.End()
```

**The result**: A hierarchy of standard OTel spans with ctrlplane-specific attributes, stored in memory until `Persist()` is called.

### Internal Storage

The builder API uses OpenTelemetry spans directly:

- `ReconcileTarget` creates a root OTel span
- Each phase creates a child OTel span
- Each evaluation/check/job/action creates a child OTel span
- `AddMetadata()` calls add OTel span events
- `SetResult()` sets OTel span attributes
- `End()` calls OTel `span.End()` and sets status

### Context Management

Even though context is not in the public API, it's still managed internally:

- `ReconcileTarget` stores a root context
- Each phase/object stores its own context
- Context cancellation can still be supported via `rt.Cancel()` method
- Timeouts can be added via `rt.WithTimeout(duration)` method

### Thread Safety

All objects should be safe for concurrent use:

- Internal spans are thread-safe (OTel guarantee)
- Metadata operations use internal locking
- Multiple evaluations can run in parallel

### External Recorder

For CLI/external systems, a separate `ExternalRecorder` type would be implemented:

```go
// Internal use only - CLI wraps this
type ExternalRecorder struct {
    token    string
    recorder *TraceRecorder
    actions  map[string]*ExternalAction
}

type ExternalAction struct {
    id   string
    span trace.Span
}

func NewExternalRecorder(token string) (*ExternalRecorder, error)
func (e *ExternalRecorder) StartAction(name string) *ExternalAction
func (e *ExternalRecorder) GetAction(id string) *ExternalAction
func (e *ExternalRecorder) Flush() error
```

## Next Steps

1. Review this design document and gather feedback
2. Iterate on open questions and naming conventions
3. Create refined API specification
4. Implement the builder API layer on top of existing OTel infrastructure
5. Implement CLI trace commands
6. Update documentation and examples
7. Migrate existing trace recording code to new API
