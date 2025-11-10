# Deployment Traces tRPC API

This document describes the tRPC endpoints for viewing deployment traces.

## Overview

The deployment traces router provides endpoints to query OpenTelemetry trace spans for deployments. These traces track the execution flow of deployment processes including planning, evaluation, and execution phases.

## Endpoints

### `byTraceId`

Get all spans for a specific trace ID.

**Input:**

```typescript
{
  workspaceId: string; // UUID
  traceId: string;
}
```

**Returns:** Array of `DeploymentTraceSpan` ordered by start time

**Example:**

```typescript
const spans = await trpc.deploymentTraces.byTraceId.query({
  workspaceId: "workspace-uuid",
  traceId: "trace-id-123",
});
```

---

### `byReleaseId`

Get all trace spans associated with a specific release.

**Input:**

```typescript
{
  workspaceId: string; // UUID
  releaseId: string;
  limit?: number; // Default: 100, Max: 1000
  offset?: number; // Default: 0
}
```

**Returns:** Array of `DeploymentTraceSpan` ordered by created date (descending)

**Example:**

```typescript
const spans = await trpc.deploymentTraces.byReleaseId.query({
  workspaceId: "workspace-uuid",
  releaseId: "release-123",
  limit: 50,
  offset: 0,
});
```

---

### `byReleaseTargetKey`

Get all trace spans for a specific release target.

**Input:**

```typescript
{
  workspaceId: string; // UUID
  releaseTargetKey: string;
  limit?: number; // Default: 100, Max: 1000
  offset?: number; // Default: 0
}
```

**Returns:** Array of `DeploymentTraceSpan` ordered by created date (descending)

**Example:**

```typescript
const spans = await trpc.deploymentTraces.byReleaseTargetKey.query({
  workspaceId: "workspace-uuid",
  releaseTargetKey: "prod-us-east-1",
});
```

---

### `byJobId`

Get all trace spans associated with a specific job.

**Input:**

```typescript
{
  workspaceId: string; // UUID
  jobId: string;
  limit?: number; // Default: 100, Max: 1000
  offset?: number; // Default: 0
}
```

**Returns:** Array of `DeploymentTraceSpan` ordered by created date (descending)

**Example:**

```typescript
const spans = await trpc.deploymentTraces.byJobId.query({
  workspaceId: "workspace-uuid",
  jobId: "job-456",
});
```

---

### `list`

List trace spans with optional filtering.

**Input:**

```typescript
{
  workspaceId: string; // UUID
  limit?: number; // Default: 100, Max: 1000
  offset?: number; // Default: 0
  filters?: {
    phase?: string; // e.g., "planning", "evaluation", "execution"
    status?: string; // e.g., "allowed", "denied", "completed"
    nodeType?: string; // e.g., "evaluation", "decision"
  };
}
```

**Returns:** Array of `DeploymentTraceSpan` ordered by created date (descending)

**Example:**

```typescript
const planningSpans = await trpc.deploymentTraces.list.query({
  workspaceId: "workspace-uuid",
  filters: {
    phase: "planning",
    status: "completed",
  },
  limit: 100,
});
```

---

### `listRootSpans`

List only root-level trace spans (spans without a parent).

**Input:**

```typescript
{
  workspaceId: string; // UUID
  limit?: number; // Default: 100, Max: 1000
  offset?: number; // Default: 0
}
```

**Returns:** Array of root `DeploymentTraceSpan` ordered by created date (descending)

**Example:**

```typescript
const rootSpans = await trpc.deploymentTraces.listRootSpans.query({
  workspaceId: "workspace-uuid",
  limit: 50,
});
```

---

### `getSpanChildren`

Get all direct children of a specific span.

**Input:**

```typescript
{
  workspaceId: string; // UUID
  traceId: string;
  spanId: string;
}
```

**Returns:** Array of child `DeploymentTraceSpan` ordered by sequence

**Example:**

```typescript
const children = await trpc.deploymentTraces.getSpanChildren.query({
  workspaceId: "workspace-uuid",
  traceId: "trace-id-123",
  spanId: "span-abc",
});
```

---

### `getUniqueTraces`

Get unique traces by returning only root spans with optional filtering.

**Input:**

```typescript
{
  workspaceId: string; // UUID
  limit?: number; // Default: 100, Max: 1000
  offset?: number; // Default: 0
  releaseId?: string;
  releaseTargetKey?: string;
  jobId?: string;
}
```

**Returns:** Array of root `DeploymentTraceSpan` representing unique traces, ordered by created date (descending)

**Example:**

```typescript
const traces = await trpc.deploymentTraces.getUniqueTraces.query({
  workspaceId: "workspace-uuid",
  releaseId: "release-123",
  limit: 20,
});
```

---

## Data Structure

### DeploymentTraceSpan

```typescript
{
  id: string; // UUID
  traceId: string; // OpenTelemetry trace ID
  spanId: string; // OpenTelemetry span ID
  parentSpanId: string | null; // Parent span ID (null for root spans)
  name: string; // Span name
  startTime: Date;
  endTime: Date | null;
  workspaceId: string; // UUID
  releaseTargetKey: string | null;
  releaseId: string | null;
  jobId: string | null;
  parentTraceId: string | null;
  phase: string | null; // e.g., "planning", "evaluation", "execution"
  nodeType: string | null; // e.g., "evaluation", "decision", "action"
  status: string | null; // e.g., "allowed", "denied", "completed"
  depth: number | null; // Tree depth
  sequence: number | null; // Execution order
  attributes: Record<string, any> | null; // Additional OTel attributes
  events: Array<{
    name: string;
    timestamp: string;
    attributes: Record<string, any>;
  }> | null;
  createdAt: Date;
}
```

## Permissions

All endpoints require appropriate permissions:

- `DeploymentTraceGet` - For viewing specific traces
- `DeploymentTraceList` - For listing and filtering traces

## Usage Examples

### Building a Trace Tree

```typescript
// Get the root span
const rootSpans = await trpc.deploymentTraces.listRootSpans.query({
  workspaceId,
  limit: 1,
});

// Recursively get children
async function buildTraceTree(traceId: string, spanId: string) {
  const children = await trpc.deploymentTraces.getSpanChildren.query({
    workspaceId,
    traceId,
    spanId,
  });

  return Promise.all(
    children.map(async (child) => ({
      ...child,
      children: await buildTraceTree(traceId, child.spanId),
    })),
  );
}
```

### Viewing Release Execution History

```typescript
// Get all traces for a release
const traces = await trpc.deploymentTraces.getUniqueTraces.query({
  workspaceId,
  releaseId,
  limit: 100,
});

// For each trace, get all spans
for (const trace of traces) {
  const spans = await trpc.deploymentTraces.byTraceId.query({
    workspaceId,
    traceId: trace.traceId,
  });
  // Process spans...
}
```

### Filtering by Phase and Status

```typescript
// Get all failed planning spans
const failedPlanning = await trpc.deploymentTraces.list.query({
  workspaceId,
  filters: {
    phase: "planning",
    status: "denied",
  },
});
```
