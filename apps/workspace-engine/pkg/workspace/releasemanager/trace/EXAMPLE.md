# Complete Example: api-service Deployment

This example shows a complete deployment trace flow matching the structure:

```
Reconcile: api-service (v1.2.3 → production)
│
├─ Planning [workspace-engine]
│  ├─ Evaluate approval policy ✓
│  ├─ Evaluate concurrency policy ✓
│  └─ Decision: deploy approved ✓
│
├─ Eligibility [workspace-engine]
│  ├─ Check already deployed ✓
│  ├─ Check failure count ✓
│  └─ Decision: eligible ✓
│
├─ Execution [workspace-engine]
│  └─ Create GitHub Action Job
│     ├─ Generate job spec ✓
│     ├─ Submit to GitHub ✓
│     └─ Generated trace token ✓
│
├─ External Execution [GitHub Action]
│  └─ Deploy via GitHub Action
│     ├─ Checkout code ✓
│     ├─ Build docker image ✓
│     ├─ Push to registry ✓
│     └─ Apply to Kubernetes
│        ├─ Apply deployment.yaml ✓
│        ├─ Apply service.yaml ✓
│        └─ Apply ingress.yaml ✓
│
└─ Verification [workspace-engine + external]
   ├─ Internal Health Checks
   │  ├─ Wait for pods ✓
   │  ├─ Check endpoints ✓
   │  └─ Check metrics ✓
   │
   └─ External Smoke Tests [Jenkins/CLI]
      ├─ Test authentication ✓
      ├─ Test core API ✓
      └─ Test database connection ✓
```

## Part 1: Workspace Engine (Internal)

```go
package releasemanager

import (
    "context"
    "github.com/ctrlplane/pkg/workspace/releasemanager/trace"
)

func ReconcileRelease(workspaceID, releaseTargetKey string, store trace.PersistenceStore) error {
    // 1. Create recorder for this reconciliation
    recorder := trace.NewRecorder(workspaceID, releaseTargetKey)
    ctx := trace.WithRecorder(context.Background(), recorder)

    // 2. Planning Phase
    ctx, planning := trace.StartPhase(ctx, trace.PhasePlanning, "Planning")

    // Evaluate policies
    ctx, _ = planning.RecordEvaluation(
        "Evaluate approval policy",
        trace.StatusAllowed,
        "Policy approved",
        map[string]any{"policy": "approval", "result": "approved"},
    )

    ctx, _ = planning.RecordEvaluation(
        "Evaluate concurrency policy",
        trace.StatusAllowed,
        "Within limits: 2/5 concurrent deployments",
        map[string]any{"policy": "concurrency", "current": 2, "limit": 5},
    )

    // Make decision
    ctx, _ = planning.RecordDecision(
        "Decision: deploy approved",
        trace.StatusAllowed,
        "All policies passed",
    )

    planning.End(trace.StatusCompleted)

    // 3. Eligibility Phase
    ctx, eligibility := trace.StartPhase(ctx, trace.PhaseEligibility, "Eligibility")

    ctx, _ = eligibility.RecordCheck(
        "Check already deployed",
        trace.StatusAllowed,
        "Version v1.2.3 not deployed",
    )

    ctx, _ = eligibility.RecordCheck(
        "Check failure count",
        trace.StatusAllowed,
        "0 recent failures",
    )

    ctx, _ = eligibility.RecordDecision(
        "Decision: eligible",
        trace.StatusAllowed,
        "Target is eligible for deployment",
    )

    eligibility.End(trace.StatusCompleted)

    // 4. Execution Phase - create GitHub Action job
    ctx, execution := trace.StartPhase(ctx, trace.PhaseExecution, "Execution")

    ctx, createJob := execution.StartAction("Create GitHub Action Job")

    // Generate job spec
    ctx, _ = createJob.RecordStep(
        "Generate job spec",
        trace.StatusCompleted,
        "Created workflow dispatch",
    )

    // Submit to GitHub
    ctx, _ = createJob.RecordStep(
        "Submit to GitHub",
        trace.StatusCompleted,
        "Workflow triggered: run_id=12345",
    )

    // Generate token for GitHub Action to report back
    traceID := trace.GetRootID(ctx)
    jobID := "job-abc-123"
    token := trace.GenerateDefaultTraceToken(traceID, jobID)

    ctx, _ = createJob.RecordStep(
        "Generated trace token",
        trace.StatusCompleted,
        "Token expires in 24h",
    )

    createJob.AddMetadata("token", token)
    createJob.AddMetadata("github_run_id", "12345")
    createJob.End(trace.StatusCompleted)

    execution.End(trace.StatusCompleted)

    // 5. Complete this portion (GitHub Action will continue externally)
    trace.Complete(ctx, trace.StatusCompleted)

    // 6. Persist to database
    if err := trace.Persist(ctx, store); err != nil {
        return err
    }

    return nil
}

// Later, after GitHub Action completes, run verification
func VerifyDeployment(workspaceID, releaseTargetKey string, store trace.PersistenceStore) error {
    // Create new recorder for verification phase
    recorder := trace.NewRecorder(workspaceID, releaseTargetKey)
    ctx := trace.WithRecorder(context.Background(), recorder)

    // Verification Phase
    ctx, verification := trace.StartPhase(ctx, trace.PhaseVerification, "Verification")

    // Internal health checks
    ctx, internal := verification.StartAction("Internal Health Checks")

    ctx, _ = internal.RecordCheck(
        "Wait for pods",
        trace.StatusAllowed,
        "3/3 pods ready",
    )

    ctx, _ = internal.RecordCheck(
        "Check endpoints",
        trace.StatusAllowed,
        "All endpoints responding",
    )

    ctx, _ = internal.RecordCheck(
        "Check metrics",
        trace.StatusAllowed,
        "Error rate: 0%, latency: 50ms",
    )

    internal.End(trace.StatusCompleted)

    // External smoke tests will run separately via CLI/Jenkins with their own token

    verification.End(trace.StatusCompleted)
    trace.Complete(ctx, trace.StatusCompleted)

    return trace.Persist(ctx, store)
}
```

## Part 2: GitHub Action (External)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production
on:
  workflow_dispatch:
    inputs:
      trace_token:
        description: "Ctrlplane trace token"
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        env:
          CTRLPLANE_TRACE_TOKEN: ${{ inputs.trace_token }}
        run: |
          # The GitHub Action calls a deployment script
          ./scripts/deploy.sh
```

```go
// scripts/deploy.go (or equivalent in your language)
package main

import (
    "context"
    "fmt"
    "os"

    "github.com/ctrlplane/pkg/workspace/releasemanager/trace"
)

func main() {
    // 1. Get trace token from environment
    token := os.Getenv("CTRLPLANE_TRACE_TOKEN")
    if token == "" {
        fmt.Println("No trace token provided, skipping trace recording")
        return
    }

    // 2. Create recorder from token - automatically validates and links to parent
    recorder, err := trace.NewRecorderFromToken(token)
    if err != nil {
        fmt.Printf("Invalid trace token: %v\n", err)
        return
    }

    ctx := trace.WithRecorder(context.Background(), recorder)

    // 3. Record deployment steps
    ctx, deploy := trace.StartAction(ctx, "Deploy via GitHub Action")

    // Checkout
    ctx, _ = deploy.RecordStep("Checkout code", trace.StatusCompleted, "")

    // Build
    ctx, _ = deploy.RecordStep(
        "Build docker image",
        trace.StatusCompleted,
        "Built image: api-service:v1.2.3",
    )

    // Push
    ctx, _ = deploy.RecordStep(
        "Push to registry",
        trace.StatusCompleted,
        "Pushed to registry.company.com/api-service:v1.2.3",
    )

    // Kubernetes apply (nested action)
    ctx, k8sApply := deploy.StartAction("Apply to Kubernetes")

    ctx, _ = k8sApply.RecordStep(
        "Apply deployment.yaml",
        trace.StatusCompleted,
        "deployment.apps/api-service configured",
    )

    ctx, _ = k8sApply.RecordStep(
        "Apply service.yaml",
        trace.StatusCompleted,
        "service/api-service configured",
    )

    ctx, _ = k8sApply.RecordStep(
        "Apply ingress.yaml",
        trace.StatusCompleted,
        "ingress.networking.k8s.io/api-service configured",
    )

    k8sApply.End(trace.StatusCompleted)
    deploy.End(trace.StatusCompleted)

    // 4. Complete and send spans back to ctrlplane API
    trace.Complete(ctx, trace.StatusCompleted)

    // Persist sends spans to ctrlplane API
    store := NewAPIStore("https://ctrlplane.company.com", os.Getenv("CTRLPLANE_API_KEY"))
    if err := trace.Persist(ctx, store); err != nil {
        fmt.Printf("Failed to persist trace: %v\n", err)
    }
}

// APIStore sends spans to ctrlplane API
type APIStore struct {
    apiURL string
    apiKey string
}

func NewAPIStore(apiURL, apiKey string) *APIStore {
    return &APIStore{apiURL: apiURL, apiKey: apiKey}
}

func (s *APIStore) WriteSpans(spans []sdktrace.ReadOnlySpan) error {
    // Convert spans to JSON and POST to /api/traces endpoint
    // The API will link these spans to the parent trace via ctrlplane.parent_trace_id
    return nil // implementation omitted
}
```

## Part 3: External Smoke Tests (CLI/Jenkins)

```bash
#!/bin/bash
# run-smoke-tests.sh

# Receive trace token from ctrlplane
TRACE_TOKEN="$1"

# Run smoke tests with ctrlplane CLI
ctrlplane trace exec \
  --token "$TRACE_TOKEN" \
  --action "External Smoke Tests" \
  -- bash -c '
    # Test authentication
    ctrlplane trace step "Test authentication" "completed" "Auth successful"

    # Test core API
    ctrlplane trace step "Test core API" "completed" "GET /health: 200 OK"

    # Test database
    ctrlplane trace step "Test database connection" "completed" "Connection successful"
  '
```

The CLI would wrap this in Go:

```go
// ctrlplane CLI trace command
func executeWithTrace(token, actionName string, command []string) error {
    // Create recorder from token
    recorder, err := trace.NewRecorderFromToken(token)
    if err != nil {
        return err
    }

    ctx := trace.WithRecorder(context.Background(), recorder)

    // Start action
    ctx, action := trace.StartAction(ctx, actionName)

    // Execute user command, intercept trace.step calls
    // (implementation details omitted)

    action.End(trace.StatusCompleted)
    trace.Complete(ctx, trace.StatusCompleted)

    // Send spans to API
    store := NewAPIStore(apiURL, apiKey)
    return trace.Persist(ctx, store)
}
```

## Result

All spans from workspace-engine, GitHub Action, and CLI are linked via `ctrlplane.parent_trace_id`, creating a unified trace showing the complete deployment journey across systems.

The UI can then display the hierarchical tree showing all decisions, actions, and outcomes from planning through verification.
