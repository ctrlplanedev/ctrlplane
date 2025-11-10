# Deployment Traces tRPC Endpoint Implementation

## Summary

Created a comprehensive tRPC endpoint for viewing deployment traces with proper authorization, filtering, and querying capabilities.

## Files Created/Modified

### Created Files

1. **`packages/trpc/src/routes/deployment-traces.ts`**
   - New tRPC router with 8 endpoints for querying deployment trace spans
   - Includes proper authorization checks using the new permissions
   - Supports various query patterns: by trace ID, release ID, job ID, release target, etc.

2. **`packages/trpc/src/routes/DEPLOYMENT_TRACES.md`**
   - Comprehensive documentation for the new API endpoints
   - Includes usage examples and data structure definitions
   - Provides common patterns like building trace trees

3. **`DEPLOYMENT_TRACES_SUMMARY.md`** (this file)
   - Implementation summary and overview

### Modified Files

1. **`packages/validators/src/auth/index.ts`**
   - Added two new permissions:
     - `DeploymentTraceGet` - For viewing specific traces
     - `DeploymentTraceList` - For listing and filtering traces

2. **`packages/trpc/src/root.ts`**
   - Imported `deploymentTracesRouter`
   - Added `deploymentTraces` to the main `appRouter`

## Endpoints

### 1. `byTraceId`

Get all spans for a specific trace ID, ordered by start time.

### 2. `byReleaseId`

Get all trace spans associated with a specific release, with pagination.

### 3. `byReleaseTargetKey`

Get all trace spans for a specific release target, with pagination.

### 4. `byJobId`

Get all trace spans associated with a specific job, with pagination.

### 5. `list`

List trace spans with optional filtering by phase, status, and nodeType.

### 6. `listRootSpans`

List only root-level trace spans (spans without a parent).

### 7. `getSpanChildren`

Get all direct children of a specific span, ordered by sequence.

### 8. `getUniqueTraces`

Get unique traces by returning only root spans with optional filtering by release, target, or job.

## Key Features

### Authorization

- All endpoints are protected with proper permission checks
- Uses workspace-scoped authorization
- Two permission levels: Get (specific) and List (general)

### Query Capabilities

- Full trace retrieval by trace ID
- Filtering by deployment context (release, target, job)
- Phase and status filtering
- Hierarchical navigation (root spans, children)
- Pagination support (limit/offset)

### Data Structure

The endpoints work with the existing `deployment_trace_span` database table which includes:

- OpenTelemetry identifiers (traceId, spanId, parentSpanId)
- Temporal data (startTime, endTime, createdAt)
- Deployment context (workspaceId, releaseId, releaseTargetKey, jobId)
- Trace attributes (phase, nodeType, status, depth, sequence)
- Additional data (attributes, events as JSONB)

## Usage Example

```typescript
// Get all traces for a release
const traces = await trpc.deploymentTraces.getUniqueTraces.query({
  workspaceId: "workspace-uuid",
  releaseId: "release-123",
  limit: 50,
});

// For each trace, get all spans
for (const trace of traces) {
  const spans = await trpc.deploymentTraces.byTraceId.query({
    workspaceId: "workspace-uuid",
    traceId: trace.traceId,
  });

  // Build tree structure or display timeline
  console.log(`Trace ${trace.traceId}:`, spans);
}

// Get child spans for hierarchical display
const children = await trpc.deploymentTraces.getSpanChildren.query({
  workspaceId: "workspace-uuid",
  traceId: trace.traceId,
  spanId: parentSpan.spanId,
});
```

## Frontend Integration

To use these endpoints in your frontend:

```typescript
import { trpc } from '@/lib/trpc';

function DeploymentTracesView({ workspaceId, releaseId }: Props) {
  const { data: traces } = trpc.deploymentTraces.getUniqueTraces.useQuery({
    workspaceId,
    releaseId,
  });

  return (
    <div>
      {traces?.map(trace => (
        <TraceCard key={trace.id} trace={trace} />
      ))}
    </div>
  );
}
```

## Testing

Type checking passed successfully for:

- ✅ `packages/trpc` - All endpoints properly typed
- ✅ `packages/validators` - New permissions compile correctly

## Next Steps

To fully utilize these endpoints, you may want to:

1. **Create UI Components**
   - Trace timeline viewer
   - Trace tree/hierarchy display
   - Filtering and search interface

2. **Add Analytics**
   - Trace duration metrics
   - Success/failure rates by phase
   - Performance bottleneck identification

3. **Real-time Updates**
   - WebSocket or polling for live trace updates
   - Progress indicators for in-flight traces

4. **Advanced Queries**
   - Add full-text search on span names
   - Time-range filtering
   - Aggregation queries (count by status, etc.)

## Database Schema

The implementation uses the existing `deployment_trace_span` table with indexes on:

- `trace_id` - Fast trace retrieval
- `workspace_id` - Workspace scoping
- `release_id`, `release_target_key`, `job_id` - Context filtering
- `parent_span_id` - Hierarchical queries
- `created_at` - Time-based ordering
- `phase`, `node_type`, `status` - Attribute filtering

## Permissions

The new permissions automatically inherit the workspace-level access control:

- Admins have full access
- Viewers can read traces (`.get` and `.list` permissions)
- Custom roles can be configured with granular trace access

## API Path

Once deployed, the endpoints will be available at:

```
POST /api/trpc/deploymentTraces.byTraceId
POST /api/trpc/deploymentTraces.byReleaseId
POST /api/trpc/deploymentTraces.byReleaseTargetKey
POST /api/trpc/deploymentTraces.byJobId
POST /api/trpc/deploymentTraces.list
POST /api/trpc/deploymentTraces.listRootSpans
POST /api/trpc/deploymentTraces.getSpanChildren
POST /api/trpc/deploymentTraces.getUniqueTraces
```
