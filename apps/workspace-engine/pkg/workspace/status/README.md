# Workspace Status Tracking

A comprehensive status tracking system for monitoring workspace lifecycle states across the workspace engine.

## Overview

The status tracking system provides real-time visibility into:

- Workspace initialization and loading
- Kafka partition assignment and event replay
- Persistence layer operations
- Error states and transitions
- Historical state changes

## Architecture

### Components

1. **WorkspaceStatus** - Tracks individual workspace state
2. **Tracker** - Global registry for all workspace statuses
3. **Manager Integration** - Automatic status updates during workspace lifecycle
4. **API Endpoints** - HTTP endpoints to query status

## States

| State                      | Description                                       |
| -------------------------- | ------------------------------------------------- |
| `unknown`                  | Workspace state is unknown                        |
| `initializing`             | Workspace is being created                        |
| `loading_from_persistence` | Loading from persistent store (Pebble/File/Kafka) |
| `loading_kafka_partitions` | Kafka partition assignment in progress            |
| `replaying_events`         | Replaying events from Kafka                       |
| `populating_initial_state` | Populating initial state                          |
| `restoring_from_snapshot`  | Restoring from persistence snapshot               |
| `ready`                    | Workspace is fully loaded and ready               |
| `error`                    | Workspace encountered an error                    |
| `unloading`                | Workspace is being removed from memory            |

## Usage

### Basic Status Tracking

```go
import "workspace-engine/pkg/workspace/status"

// Get or create status for a workspace
workspaceStatus := status.Global().GetOrCreate(workspaceID)

// Update state
workspaceStatus.SetState(status.StateInitializing, "Starting workspace")

// Add metadata
workspaceStatus.UpdateMetadata("partition", 5)
workspaceStatus.UpdateMetadata("events_replayed", 1000)

// Mark as ready
workspaceStatus.SetState(status.StateReady, "Workspace loaded successfully")

// Handle errors
if err != nil {
    workspaceStatus.SetError(err)
    return err
}
```

### Kafka Consumer Integration

```go
import (
    "workspace-engine/pkg/workspace/status"
    "github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func consumeWorkspaceEvents(workspaceID string) error {
    workspaceStatus := status.Global().GetOrCreate(workspaceID)

    // Track partition assignment
    workspaceStatus.SetState(
        status.StateLoadingKafkaPartitions,
        "Waiting for Kafka partition assignment",
    )

    consumer, err := kafka.NewConsumer(&kafka.ConfigMap{
        "group.id": workspaceID,
        // ... other config
    })
    if err != nil {
        workspaceStatus.SetError(err)
        return err
    }
    defer consumer.Close()

    // Subscribe to topic
    topic := "workspace-events"
    err = consumer.SubscribeTopics([]string{topic}, nil)
    if err != nil {
        workspaceStatus.SetError(err)
        return err
    }

    // Wait for partition assignment
    // This is where you'd use Kafka rebalance callbacks
    workspaceStatus.SetState(
        status.StateReplayingEvents,
        "Replaying events from Kafka",
    )
    workspaceStatus.UpdateMetadata("topic", topic)

    eventsProcessed := 0
    for {
        msg, err := consumer.ReadMessage(timeout)
        if err != nil {
            continue
        }

        // Process message
        processEvent(msg)
        eventsProcessed++

        // Update progress periodically
        if eventsProcessed%100 == 0 {
            workspaceStatus.UpdateMetadata("events_processed", eventsProcessed)
        }
    }

    workspaceStatus.SetState(status.StateReady, "Workspace ready")
    return nil
}
```

### With Partition-Specific Tracking

```go
func trackPartitionLoading(workspaceID string, partition int32) {
    workspaceStatus := status.Global().GetOrCreate(workspaceID)

    workspaceStatus.SetState(
        status.StateLoadingKafkaPartitions,
        fmt.Sprintf("Loading partition %d", partition),
    )

    workspaceStatus.UpdateMetadata("partition", partition)
    workspaceStatus.UpdateMetadata("partition_status", "seeking_offset")

    // Get partition offset
    offset, err := getPartitionOffset(partition)
    if err != nil {
        workspaceStatus.SetError(err)
        return
    }

    workspaceStatus.UpdateMetadata("partition_offset", offset)
    workspaceStatus.UpdateMetadata("partition_status", "reading")
}
```

### Querying Status

```go
// Get status snapshot (thread-safe)
snapshot, exists := status.Global().GetSnapshot(workspaceID)
if exists {
    fmt.Printf("Workspace %s is in state: %s\n",
        snapshot.WorkspaceID, snapshot.State)
    fmt.Printf("Time in current state: %s\n",
        snapshot.TimeInCurrentState())
}

// Check if ready
if workspaceStatus.IsReady() {
    // Workspace is ready for use
}

// Get all statuses
allStatuses := status.Global().ListAll()

// Get state counts
stateCounts := status.Global().CountByState()
fmt.Printf("Ready workspaces: %d\n", stateCounts[status.StateReady])
fmt.Printf("Loading workspaces: %d\n", stateCounts[status.StateLoadingKafkaPartitions])
```

## API Endpoints

### Get Workspace Status

```bash
GET /api/v1/workspaces/{workspaceId}/status
```

**Response:**

```json
{
  "workspaceId": "workspace-123",
  "state": "ready",
  "healthy": true,
  "message": "Workspace loaded and ready",
  "stateEntered": "2024-10-25T19:00:00Z",
  "lastUpdated": "2024-10-25T19:00:05Z",
  "timeInState": "5m30s",
  "metadata": {
    "changes_loaded": 150,
    "partition": 5,
    "events_replayed": 1000
  },
  "recentHistory": [
    {
      "fromState": "initializing",
      "toState": "loading_from_persistence",
      "timestamp": "2024-10-25T18:59:55Z",
      "message": "Loading workspace from persistent store"
    },
    {
      "fromState": "loading_from_persistence",
      "toState": "replaying_events",
      "timestamp": "2024-10-25T18:59:57Z",
      "message": "Replaying events from Kafka"
    },
    {
      "fromState": "replaying_events",
      "toState": "ready",
      "timestamp": "2024-10-25T19:00:00Z",
      "message": "Workspace loaded and ready"
    }
  ]
}
```

### List All Workspace Statuses

```bash
GET /api/v1/workspaces/statuses
```

**Response:**

```json
{
  "workspaces": [
    {
      "workspaceId": "workspace-123",
      "state": "ready",
      "message": "Workspace loaded and ready",
      ...
    },
    {
      "workspaceId": "workspace-456",
      "state": "loading_kafka_partitions",
      "message": "Waiting for Kafka partition assignment",
      ...
    }
  ],
  "totalCount": 2,
  "stateCounts": {
    "ready": 1,
    "loading_kafka_partitions": 1
  }
}
```

## Best Practices

### 1. Update Status at Key Transition Points

```go
// ✅ Good - Clear state transitions
workspaceStatus.SetState(status.StateInitializing, "Creating workspace")
ws := workspace.New(ctx, id)

workspaceStatus.SetState(status.StateLoadingKafkaPartitions, "Assigning partitions")
assignPartitions()

workspaceStatus.SetState(status.StateReady, "Workspace ready")
```

### 2. Use Metadata for Progress Tracking

```go
// ✅ Good - Track detailed progress
workspaceStatus.UpdateMetadata("events_total", totalEvents)
workspaceStatus.UpdateMetadata("events_processed", processedEvents)
workspaceStatus.UpdateMetadata("progress_percent",
    float64(processedEvents)/float64(totalEvents)*100)
```

### 3. Always Set Error States

```go
// ✅ Good - Proper error handling
if err != nil {
    workspaceStatus.SetError(err)
    return err
}
```

### 4. Clean Up When Unloading

```go
// ✅ Good - Mark as unloading before removal
workspaceStatus.SetState(status.StateUnloading, "Removing workspace from memory")
manager.Workspaces().Remove(workspaceID)
// Optionally remove status after some time
// status.Global().Remove(workspaceID)
```

## Thread Safety

All operations are thread-safe:

- `WorkspaceStatus` uses `sync.RWMutex` for internal state
- `Tracker` uses `sync.RWMutex` for the status registry
- `GetSnapshot()` returns a deep copy, safe to use concurrently

## Performance Considerations

- Status updates are fast (mutex-protected map operations)
- History is limited to last 20 transitions automatically
- Snapshots create copies - cache if querying frequently
- Metadata is stored as `map[string]interface{}` - use appropriate types

## Monitoring & Alerting

You can build monitoring on top of status tracking:

```go
// Alert if workspace stuck in loading state
if snapshot.TimeInCurrentState() > 5*time.Minute &&
   snapshot.State == status.StateLoadingKafkaPartitions {
    alerting.Send("Workspace stuck loading partitions", workspaceID)
}

// Track workspace loading times
if snapshot.State == status.StateReady {
    for _, transition := range snapshot.StateHistory {
        if transition.FromState == status.StateInitializing {
            loadTime := snapshot.StateEntered.Sub(transition.Timestamp)
            metrics.RecordWorkspaceLoadTime(loadTime)
        }
    }
}
```
