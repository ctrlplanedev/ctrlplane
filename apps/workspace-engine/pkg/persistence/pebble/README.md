# Pebble Persistence Store

A high-performance, embedded key-value store implementation of the `persistence.Store` interface using [CockroachDB's Pebble](https://github.com/cockroachdb/pebble).

## Overview

The Pebble store provides:

- **Automatic Compaction**: Pebble's LSM-tree architecture naturally compacts data - newer writes overwrite older ones for the same key
- **High Performance**: Optimized for both read and write operations with configurable caching
- **Durability**: Supports synchronous writes for guaranteed persistence
- **Thread-Safety**: Safe for concurrent reads and writes
- **Namespace Isolation**: Each workspace gets isolated storage via key prefixing

## Key Design

Keys are structured as: `namespace:entityType:entityID`

This design provides:

- Natural namespace isolation via prefix scans
- Automatic compaction (same entity ID overwrites previous values)
- Efficient range queries per namespace

## Usage

### Basic Example

```go
// Create store
store, err := pebble.NewStore("/path/to/db")
if err != nil {
    log.Fatal(err)
}
defer store.Close()

// Register entity types
store.RegisterEntityType("deployment", func() persistence.Entity {
    return &Deployment{}
})

// Save changes
changes := persistence.NewChangesBuilder("workspace-1").
    Set(&Deployment{ID: "d1", Name: "API"}).
    Build()

err = store.Save(ctx, changes)

// Load current state
loaded, err := store.Load(ctx, "workspace-1")
```

### With Manager

```go
// Build persistence manager
manager := persistence.NewManagerBuilder().
    WithStore(store).
    RegisterRepository("deployment", deploymentRepo).
    Build()

// Restore workspace state
err := manager.Restore(ctx, "workspace-1")

// Persist changes
changes := persistence.NewChangesBuilder("workspace-1").
    Set(&Deployment{ID: "d1", Name: "Updated"}).
    Build()

err = manager.Persist(ctx, changes)
```

## Features

### Automatic Compaction

Pebble automatically compacts data in the background. When you save the same entity multiple times:

```go
// Save entity 3 times
store.Save(ctx, persistence.NewChangesBuilder("ws-1").
    Set(&Deployment{ID: "d1", Name: "v1"}).Build())

store.Save(ctx, persistence.NewChangesBuilder("ws-1").
    Set(&Deployment{ID: "d1", Name: "v2"}).Build())

store.Save(ctx, persistence.NewChangesBuilder("ws-1").
    Set(&Deployment{ID: "d1", Name: "v3"}).Build())

// Load returns only the latest version
loaded, _ := store.Load(ctx, "ws-1")
// loaded contains only: Deployment{ID: "d1", Name: "v3"}
```

The compaction happens because:

1. All three saves use the same key: `ws-1:deployment:d1`
2. Pebble's write path overwrites the previous value
3. Background compaction eventually removes old versions from disk

### Namespace Management

```go
// List all namespaces
namespaces, err := store.ListNamespaces()

// Delete entire namespace
err = store.DeleteNamespace("workspace-1")
```

### Performance Tuning

Customize Pebble options during creation:

```go
// In pebble.go, modify NewStore to accept options:
db, err := pebble.Open(dbPath, &pebble.Options{
    // Increase cache size for better read performance
    Cache: pebble.NewCache(512 << 20), // 512MB

    // Adjust compaction settings
    DisableAutomaticCompactions: false,

    // Set memory table size
    MemTableSize: 64 << 20, // 64MB
})
```

## Architecture

### Storage Format

Each change is stored as a JSON-encoded value:

```json
{
  "namespace": "workspace-1",
  "changeType": "set",
  "entityType": "deployment",
  "entityID": "d1",
  "entity": {...},
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### Compaction Strategy

1. **Write Path**: New writes use the composite key `namespace:entityType:entityID`
2. **Overwrite**: Same key = automatic overwrite, no duplicates in write path
3. **Background Compaction**: Pebble's LSM-tree compaction removes old versions from disk
4. **Read Path**: Load scans namespace prefix, returns one entry per entity

### Thread Safety

- Read lock for Load operations (parallel reads)
- Write lock for Save operations (serialized writes)
- Pebble handles internal concurrency

## Comparison with Other Stores

| Feature            | Pebble          | File Store     | Memory Store |
| ------------------ | --------------- | -------------- | ------------ |
| Persistence        | Disk (durable)  | Disk (JSONL)   | Memory only  |
| Compaction         | Automatic (LSM) | Manual/on-load | Immediate    |
| Performance        | High            | Medium         | Highest      |
| Concurrency        | Excellent       | Good           | Excellent    |
| Storage Efficiency | High            | Medium         | N/A          |
| Use Case           | Production      | Development    | Testing      |

## When to Use

**Use Pebble Store when:**

- You need production-grade persistence
- Performance is critical (high read/write throughput)
- You want automatic compaction without manual intervention
- Working with large datasets

**Use File Store when:**

- You want human-readable storage (JSONL)
- Debugging and inspecting data is important
- Simple deployment without external dependencies

**Use Memory Store when:**

- Running tests
- Prototyping
- No persistence needed

## Testing

Run tests:

```bash
go test -v ./pkg/persistence/pebble
```

Run benchmarks:

```bash
go test -bench=. ./pkg/persistence/pebble
```

## Implementation Notes

### Entity Registry

Like the file store, Pebble requires entity types to be registered:

```go
store.RegisterEntityType("deployment", func() persistence.Entity {
    return &Deployment{}
})
```

This is needed to deserialize JSON back into the correct Go types.

### Timestamps

- Timestamps are preserved exactly as provided
- If no timestamp is provided, `time.Now()` is used
- Timestamps are compared during compaction (latest wins)

### Error Handling

All operations return errors that should be checked:

- Database corruption
- Disk full
- Permission errors
- Serialization failures

### Cleanup

Always close the store when done:

```go
defer store.Close()
```

This ensures:

- Pending writes are flushed
- Resources are released
- Database is properly shut down

## Advanced Usage

### Batch Operations

The store automatically batches writes within a single `Save()` call for efficiency:

```go
// These are written in a single atomic batch
changes := persistence.NewChangesBuilder("workspace-1").
    Set(&Deployment{ID: "d1", Name: "API"}).
    Set(&Deployment{ID: "d2", Name: "Worker"}).
    Set(&Environment{ID: "e1", Name: "Prod"}).
    Build()

store.Save(ctx, changes) // Atomic batch write
```

### Prefix Iteration

The Load operation uses Pebble's efficient prefix iteration:

```go
// Internally, this creates a prefix iterator
// Only scans keys starting with "workspace-1:"
loaded, err := store.Load(ctx, "workspace-1")
```

This is much faster than scanning all keys and filtering.
