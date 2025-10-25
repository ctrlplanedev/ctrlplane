# Changelog Package

A compact Kafka changelog system for tracking workspace events. This package provides a simple interface for writing and reading from compacted Kafka topics, with automatic partitioning by workspace ID.

## Overview

The changelog package allows you to track events for specific workspaces using Kafka's log compaction feature. Objects are automatically partitioned by workspace ID (extracted from the first UUID in the key), ensuring that all events for a workspace go to the same partition.

## Key Concepts

### Changeloggable Interface

Any object that needs to be tracked must implement the `Changeloggable` interface:

```go
type Changeloggable interface {
    // ChangeLogID returns a unique identifier in the format:
    // "{workspaceID}/{entityType}/{entityID}"
    ChangeLogID() string
}
```

### Key Format

The `ChangeLogID()` should return a string in the format:

```
{workspaceID}/{entityType}/{entityID}
```

For example:

- `550e8400-e29b-41d4-a716-446655440000/deployment/dep-123`
- `ws-abc/resource/res-xyz`

The **first segment** (before the first `/`) is treated as the workspace ID and is used for partitioning.

### Partitioning

All events with the same workspace ID will be routed to the same partition using Kafka's Murmur2 hash function. This ensures:

- Events for a workspace are ordered
- Workspace state can be loaded from a single partition
- Horizontal scaling by distributing workspaces across partitions

## Usage

### Quick Start

The easiest way to get started is using the built-in producer and consumer factories:

```go
package main

import (
    "context"
    "workspace-engine/pkg/kafka/changelog"
)

// Define your entity
type Deployment struct {
    WorkspaceID string `json:"workspace_id"`
    ID          string `json:"id"`
    Name        string `json:"name"`
    Version     string `json:"version"`
}

// Implement Changeloggable
func (d *Deployment) ChangeLogID() string {
    return "/deployment/" + d.ID
}

func main() {
    ctx := context.Background()

    // Create changelog writer (includes optimized producer config)
    writer, err := changelog.NewChangelogWriter(
        "localhost:9092",
        "workspace-changelog",
        10, // number of partitions
    )
    if err != nil {
        panic(err)
    }
    defer writer.Close()

    // Write an entity
    deployment := &Deployment{
        WorkspaceID: "ws-123",
        ID:          "dep-456",
        Name:        "my-app",
        Version:     "v1.0.0",
    }

    // Set the entity in the changelog
    if err := writer.Set(ctx, "ws-123", deployment); err != nil {
        panic(err)
    }

    // Ensure all writes are flushed
    writer.Flush(5000)
}
```

### Writing to the Changelog (Advanced)

If you need more control over the producer configuration:

```go
package main

import (
    "context"
    "workspace-engine/pkg/kafka/changelog"
)

func main() {
    ctx := context.Background()

    // Create producer with custom config
    producer, err := changelog.NewChangelogProducer("localhost:9092")
    if err != nil {
        panic(err)
    }

    // Create changelog writer
    writer := changelog.NewWriter(producer, "workspace-changelog", 10)
    defer writer.Close()

    // Write an entity
    deployment := &Deployment{
        WorkspaceID: "ws-123",
        ID:          "dep-456",
        Name:        "my-app",
        Version:     "v1.0.0",
    }

    if err := writer.Set(ctx, "ws-123", deployment); err != nil {
        panic(err)
    }

    // Ensure all writes are flushed
    writer.Flush(5000)
}
```

### Reading from the Changelog

#### Quick Start

```go
package main

import (
    "context"
    "log"
    "workspace-engine/pkg/kafka/changelog"
)

func main() {
    ctx := context.Background()

    // Create changelog reader (includes optimized consumer config)
    reader, err := changelog.NewChangelogReader(
        "localhost:9092",
        "workspace-changelog",
        "changelog-reader-group",
    )
    if err != nil {
        panic(err)
    }
    defer reader.Close()

    // Option 1: Load all entries into a map
    entries, err := reader.LoadAllIntoMap(ctx)
    if err != nil {
        panic(err)
    }

    for key, entry := range entries {
        var deployment Deployment
        if err := entry.UnmarshalInto(&deployment); err != nil {
            log.Printf("Failed to unmarshal: %v", err)
            continue
        }
        log.Printf("Loaded deployment: %s - %s", key, deployment.Name)
    }

    // Option 2: Load only entries for a specific workspace
    wsEntries, err := reader.LoadForWorkspace(ctx, "ws-123")
    if err != nil {
        panic(err)
    }

    log.Printf("Loaded %d entries for workspace ws-123", len(wsEntries))

    // Option 3: Process entries one by one
    err = reader.LoadAll(ctx, func(entry *changelog.ChangelogEntry) error {
        if entry.IsTombstone {
            log.Printf("Deleted: %s", entry.Key)
            return nil
        }

        var deployment Deployment
        if err := entry.UnmarshalInto(&deployment); err != nil {
            return err
        }

        log.Printf("Processing: %s", deployment.Name)
        return nil
    })
}
```

### Deleting Entries (Tombstoning)

```go
// Delete an entry by writing a tombstone
// Provide the workspace ID and the changelog ID
if err := writer.Delete(ctx, "ws-123", "/deployment/dep-456"); err != nil {
    panic(err)
}
```

When the topic is compacted, tombstoned entries will be removed.

### Environment Variables

The changelog package supports the following environment variables:

```bash
# Kafka broker addresses
KAFKA_BROKERS=localhost:9092

# Default changelog topic name
KAFKA_CHANGELOG_TOPIC=workspace-changelog

# Default consumer group ID
KAFKA_CHANGELOG_GROUP_ID=workspace-changelog-consumer
```

## Producer & Consumer Configuration

### Producer Configuration

The changelog producer is configured with the following optimizations:

- **`enable.idempotence: true`** - Ensures exactly-once semantics per partition, critical for preventing duplicate changelog entries
- **`acks: all`** - Requires acknowledgment from all in-sync replicas for maximum durability
- **`compression.type: snappy`** - Reduces network and storage overhead
- **`max.in.flight.requests.per.connection: 5`** - Limited to maintain ordering when idempotence is enabled
- **Retry configuration** - Automatic retries with backoff for transient failures

### Consumer Configuration

The changelog consumer is configured for optimal state rebuilding:

- **`auto.offset.reset: earliest`** - Reads the full compacted state from the beginning
- **`enable.auto.commit: false`** - Manual offset management for precise control
- **`partition.assignment.strategy: cooperative-sticky`** - Minimizes partition movement during rebalances
- **Extended timeouts** - Allows time for processing large compacted states

## Topic Configuration

For the changelog to work properly, the Kafka topic should be configured with log compaction:

```bash
kafka-topics --create \
  --topic workspace-changelog \
  --partitions 10 \
  --replication-factor 3 \
  --config cleanup.policy=compact \
  --config compression.type=snappy \
  --config min.compaction.lag.ms=60000
```

Key configuration options:

- `cleanup.policy=compact`: Enable log compaction
- `compression.type=snappy`: Compress messages for efficiency
- `min.compaction.lag.ms`: How long to wait before compacting (e.g., 1 minute)
- `segment.ms`: How often to roll new segments (default 7 days)
- `delete.retention.ms`: How long to keep tombstone markers (default 24 hours)

## Best Practices

1. **Use UUIDs for Workspace IDs**: UUIDs distribute evenly across partitions
2. **Keep Values Small**: Compacted topics keep the latest value per key, so smaller values are more efficient
3. **Batch Writes**: Use `Flush()` to batch multiple writes for better throughput
4. **Handle Tombstones**: Always check `IsTombstone` when processing entries
5. **Idempotent Writes**: The same key can be written multiple times; the latest value wins
6. **Monitor Compaction**: Check Kafka metrics to ensure compaction is running

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  Workspace Events                        │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ ChangeLogID() Method  │
              │ "ws-123/deployment/..." │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │  Extract Workspace ID │
              │      "ws-123"         │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │   Murmur2 Hash        │
              │   (same as Kafka)     │
              └───────────────────────┘
                          │
                          ▼
         ┌────────────────┴────────────────┐
         │                                 │
    Partition 0                       Partition N
    ws-123, ws-456                   ws-789, ws-012
         │                                 │
         ▼                                 ▼
    [Compacted Log]                  [Compacted Log]
    Latest value per key             Latest value per key
```

## Testing

Run the tests:

```bash
go test ./pkg/kafka/changelog/...
```

The tests use an in-memory Kafka implementation for fast, isolated testing.

## See Also

- [Kafka Log Compaction](https://kafka.apache.org/documentation/#compaction)
- [Workspace Partitioning](../../workspace/kafka/README.md)
- [Messaging Abstraction](../../messaging/README.md)
