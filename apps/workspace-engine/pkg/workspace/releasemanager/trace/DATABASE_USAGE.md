# Database Storage Usage

This document shows how to use the database persistence layer for deployment traces.

## Quick Start

```go
import (
    "context"
    "workspace-engine/pkg/db"
    "workspace-engine/pkg/workspace/releasemanager/trace"
    "workspace-engine/pkg/workspace/releasemanager/trace/spanstore"
)

func ReconcileWithTracing(ctx context.Context, workspaceID, releaseTargetKey string) error {
    // Get database connection pool
    pool := db.GetPool(ctx)

    // Create database store
    store := spanstore.NewDBStore(pool)

    // Create trace recorder with store
    rt := trace.NewReconcileTargetWithStore(workspaceID, releaseTargetKey, store)

    // Automatically persist on function exit
    defer func() {
        rt.Complete(trace.StatusCompleted)
        if err := rt.Persist(); err != nil {
            log.Printf("Failed to persist trace: %v", err)
        }
    }()

    // Record deployment trace
    planning := rt.StartPlanning()
    eval := planning.StartEvaluation("Approval Policy")
    eval.AddMetadata("approver", "alice")
    eval.SetResult(trace.ResultAllowed, "Approved")
    eval.End()
    planning.MakeDecision("Deploy approved", trace.DecisionApproved)
    planning.End()

    return nil
}
```

## Database Schema

### Table: `deployment_trace_span`

Stores OpenTelemetry spans with deployment-specific attributes.

**Columns:**

- `id` - UUID primary key
- `trace_id` - OTel trace identifier (text)
- `span_id` - OTel span identifier (text)
- `parent_span_id` - Parent span ID for hierarchy (text, nullable)
- `name` - Span name (text)
- `start_time` - Start timestamp (timestamptz)
- `end_time` - End timestamp (timestamptz, nullable)
- `workspace_id` - Workspace UUID (FK to workspace, cascade delete)
- `release_target_key` - Release target identifier (text)
- `release_id` - Release ID (text, no FK)
- `job_id` - Job ID (text, no FK)
- `parent_trace_id` - Links external traces (text)
- `phase` - Deployment phase (text)
- `node_type` - Span type (text)
- `status` - Span status (text)
- `depth` - Tree depth (integer)
- `sequence` - Execution order (integer)
- `attributes` - All span attributes (JSONB)
- `events` - Span events/metadata (JSONB)
- `created_at` - Record creation time (timestamptz)

**Indexes:**

- Unique: (trace_id, span_id)
- Query: trace_id, parent_span_id, workspace_id, release_target_key, release_id, job_id, parent_trace_id, created_at, phase, node_type, status

## Storage Implementation

### DBStore

```go
type DBStore struct {
    pool *pgxpool.Pool
}

func NewDBStore(pool *pgxpool.Pool) *DBStore
func (s *DBStore) WriteSpans(ctx, spans) error
```

**Features:**

- Batch insert using `pgx.Batch` for performance
- Transaction support for atomicity
- Extracts OTel span data and ctrlplane attributes
- Converts events to JSONB
- Handles nullable fields properly
- Proper connection lifecycle management

### Attribute Extraction

The store automatically extracts ctrlplane attributes from OTel spans:

```go
// From span attributes:
ctrlplane.phase → phase column
ctrlplane.node_type → node_type column
ctrlplane.status → status column
ctrlplane.workspace_id → workspace_id column
ctrlplane.release_id → release_id column
ctrlplane.job_id → job_id column
// ... etc

// All attributes also stored in attributes JSONB column
```

## Usage Patterns

### Pattern 1: With Pre-Configured Store

```go
// Create store once, reuse for multiple traces
pool := db.GetPool(ctx)
store := spanstore.NewDBStore(pool)

// Use with store configured at creation
rt := trace.NewReconcileTargetWithStore(workspaceID, releaseTargetKey, store)
defer func() {
    rt.Complete(trace.StatusCompleted)
    rt.Persist() // Uses configured store
}()
```

### Pattern 2: Provide Store at Persist Time

```go
// Create recorder without store
rt := trace.NewReconcileTarget(workspaceID, releaseTargetKey)

// Provide store when persisting
defer func() {
    rt.Complete(trace.StatusCompleted)

    pool := db.GetPool(ctx)
    store := spanstore.NewDBStore(pool)
    rt.Persist(store)
}()
```

### Pattern 3: Error Handling

```go
rt := trace.NewReconcileTargetWithStore(workspaceID, releaseTargetKey, store)

defer func() {
    rt.Complete(trace.StatusCompleted)

    if err := rt.Persist(); err != nil {
        // Log error but don't fail the deployment
        log.Printf("Warning: Failed to persist trace: %v", err)
        // Optionally send to error tracking
        sentry.CaptureError(err)
    }
}()

// Deployment continues regardless of trace persistence errors
```

## Querying Traces

### Get All Spans for a Trace

```sql
SELECT *
FROM deployment_trace_span
WHERE trace_id = '<trace-id>'
ORDER BY sequence ASC;
```

### Get Spans for a Release Target

```sql
SELECT *
FROM deployment_trace_span
WHERE release_target_key = 'api-service-production'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC, sequence ASC;
```

### Get Spans for a Job

```sql
SELECT *
FROM deployment_trace_span
WHERE job_id = '<job-id>'
ORDER BY sequence ASC;
```

### Get External Traces Linked to Parent

```sql
-- Get parent trace
SELECT *
FROM deployment_trace_span
WHERE trace_id = '<parent-trace-id>'

UNION ALL

-- Get all child traces
SELECT *
FROM deployment_trace_span
WHERE parent_trace_id = '<parent-trace-id>'

ORDER BY created_at ASC, sequence ASC;
```

### Find Failed Deployments

```sql
SELECT DISTINCT trace_id, release_target_key, created_at
FROM deployment_trace_span
WHERE status = 'failed'
  AND node_type = 'decision'
  AND workspace_id = '<workspace-id>'
  AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

## Performance Considerations

### Batch Inserts

The DBStore uses batch inserts for efficiency:

```go
// Single transaction with batch insert
batch := &pgx.Batch{}
for _, span := range spans {
    batch.Queue("INSERT INTO deployment_trace_span ...")
}
results := tx.SendBatch(ctx, batch)
```

**Benefits:**

- Reduced database round trips
- Better performance for multi-span traces
- Atomic persistence (all-or-nothing)

### Indexes

The schema includes indexes on commonly queried fields:

- `trace_id` - Retrieve complete traces
- `workspace_id` - Workspace-scoped queries
- `job_id`, `release_id` - Link to deployments
- `created_at` - Time-based queries
- `phase`, `node_type`, `status` - Filter by trace characteristics

### Cleanup

Old traces can be cleaned up by workspace:

```sql
-- Delete traces older than 90 days
DELETE FROM deployment_trace_span
WHERE workspace_id = '<workspace-id>'
  AND created_at < NOW() - INTERVAL '90 days';
```

Workspace deletion automatically cascades to delete all traces (FK constraint).

## Data Model

### Attributes JSONB

All OTel span attributes are stored in the `attributes` JSONB column:

```json
{
  "ctrlplane.phase": "planning",
  "ctrlplane.node_type": "evaluation",
  "ctrlplane.status": "allowed",
  "ctrlplane.workspace_id": "ws-123",
  "ctrlplane.depth": 2,
  "ctrlplane.sequence": 5,
  "custom_attribute": "custom_value"
}
```

### Events JSONB

Span events (metadata, results) are stored in the `events` JSONB column:

```json
[
  {
    "name": "approver",
    "timestamp": "2024-01-15T10:30:00.123456789Z",
    "attributes": {
      "approver": "alice@company.com"
    }
  },
  {
    "name": "policy",
    "timestamp": "2024-01-15T10:30:00.234567890Z",
    "attributes": {
      "policy": "approval",
      "required": 1
    }
  }
]
```

## Migration

The database table is created via Drizzle migration:

```bash
cd packages/db
npm run generate  # Generate migration
npm run migrate   # Apply to database
```

**Migration file:** `drizzle/XXXX_deployment_trace_span.sql`

Creates:

- `deployment_trace_span` table
- All indexes
- Foreign key to workspace
- Unique constraint on (trace_id, span_id)

## Example: Complete Workflow

```go
package releasemanager

import (
    "context"
    "workspace-engine/pkg/db"
    "workspace-engine/pkg/workspace/releasemanager/trace"
    "workspace-engine/pkg/workspace/releasemanager/trace/spanstore"
)

func ReconcileDeployment(ctx context.Context, workspaceID, releaseTargetKey string) error {
    // Setup trace persistence
    pool := db.GetPool(ctx)
    store := spanstore.NewDBStore(pool)

    rt := trace.NewReconcileTargetWithStore(workspaceID, releaseTargetKey, store)
    defer func() {
        rt.Complete(trace.StatusCompleted)
        if err := rt.Persist(); err != nil {
            log.Printf("Trace persistence failed: %v", err)
        }
    }()

    // Planning
    planning := rt.StartPlanning()

    eval := planning.StartEvaluation("Approval Policy")
    eval.AddMetadata("policy_type", "approval")
    eval.AddMetadata("required_approvals", 1)
    eval.SetResult(trace.ResultAllowed, "Approved by alice")
    eval.End()

    planning.MakeDecision("Deploy approved", trace.DecisionApproved)
    planning.End()

    // Eligibility
    eligibility := rt.StartEligibility()

    check := eligibility.StartCheck("Already Deployed")
    check.AddMetadata("target_version", "v1.2.3")
    check.SetResult(trace.CheckResultPass, "Not deployed")
    check.End()

    eligibility.MakeDecision("Eligible", trace.DecisionApproved)
    eligibility.End()

    // Execution
    execution := rt.StartExecution()

    job := execution.TriggerJob("github-action", map[string]string{
        "workflow": "deploy.yml",
    })
    job.AddMetadata("github_run_id", "8765432109")
    token := job.Token() // For external system
    job.End()

    execution.End()

    // Verification
    verification := rt.StartAction("Verification")
    verification.AddStep("Check pods", trace.StepResultPass, "3/3 ready")
    verification.AddStep("Check endpoints", trace.StepResultPass, "200 OK")
    verification.End()

    return nil
}
// On function exit, defer persists all spans to deployment_trace_span table
```

**Result in Database:**

Multiple rows in `deployment_trace_span` table representing the complete deployment trace tree, queryable by trace_id, workspace_id, job_id, release_target_key, etc.
