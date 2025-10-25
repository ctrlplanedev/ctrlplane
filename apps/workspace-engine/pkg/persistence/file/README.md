## File-based Persistence Store

A JSONL (JSON Lines) based implementation of the `persistence.Store` interface. Each namespace gets its own `.jsonl` file with automatic compaction.

## Features

- **No external dependencies**: Uses only Go standard library (`encoding/json`, `bufio`, `os`)
- **JSONL format**: One JSON object per line, human-readable and easy to inspect
- **Automatic compaction**: On load, keeps only the latest change per entity
- **Manual compaction**: Rewrite files to remove duplicates and save space
- **Thread-safe**: Safe for concurrent reads and writes
- **Multiple namespaces**: Each namespace stored in separate file

## Usage

### Basic Setup

```go
import (
    "workspace-engine/pkg/persistence/file"
    "workspace-engine/pkg/oapi"
)

// Create store
store, err := file.NewStore("./data/persistence")
if err != nil {
    log.Fatal(err)
}
defer store.Close()

// Register entity types (required for unmarshaling)
store.RegisterEntityType("system", func() persistence.Entity {
    return &oapi.System{}
})
store.RegisterEntityType("resource", func() persistence.Entity {
    return &oapi.Resource{}
})
store.RegisterEntityType("deployment", func() persistence.Entity {
    return &oapi.Deployment{}
})
// ... register all entity types you need
```

### Save Changes

```go
changes := persistence.NewChangesBuilder("workspace-1").
    Set(&oapi.System{
        Id:   "sys-123",
        Name: "Production System",
    }).
    Set(&oapi.Resource{
        Id:   "res-456",
        Name: "server-1",
        Kind: "EC2Instance",
    }).
    Build()

err := store.Save(ctx, changes)
```

### Load State

```go
// Load all entities for a namespace
changes, err := store.Load(ctx, "workspace-1")
if err != nil {
    log.Fatal(err)
}

// Changes are already compacted - only latest state per entity
for _, change := range changes {
    switch e := change.Entity.(type) {
    case *oapi.System:
        fmt.Printf("System: %s\n", e.Name)
    case *oapi.Resource:
        fmt.Printf("Resource: %s\n", e.Name)
    }
}
```

### Manual Compaction

```go
// Compact a namespace file to reduce disk space
err := store.Compact(ctx, "workspace-1")
```

### List Namespaces

```go
namespaces, err := store.ListNamespaces()
for _, ns := range namespaces {
    fmt.Printf("Namespace: %s\n", ns)
}
```

## File Format

Each namespace is stored as `{namespace}.jsonl` with one JSON object per line:

```jsonl
{"namespace":"workspace-1","changeType":"set","entityType":"system","entityID":"sys-123","entity":{"id":"sys-123","name":"Production System"},"timestamp":"2025-10-25T12:00:00Z"}
{"namespace":"workspace-1","changeType":"set","entityType":"resource","entityID":"res-456","entity":{"id":"res-456","name":"server-1","kind":"EC2Instance"},"timestamp":"2025-10-25T12:01:00Z"}
```

## Integration with Workspace Manager

```go
import (
    "workspace-engine/pkg/persistence/file"
    "workspace-engine/pkg/workspace/manager"
)

// Create and configure file store
fileStore, err := file.NewStore("./data/persistence")
if err != nil {
    log.Fatal(err)
}

// Register all OAPI entity types
registerAllEntityTypes(fileStore)

// Configure manager to use file store
manager.Configure(
    manager.WithPersistentStore(fileStore),
)

// Use as normal
ws, err := manager.GetOrLoad(ctx, "workspace-1")
```

## Entity Type Registration

You must register all entity types that will be stored. This is required for unmarshaling:

```go
func registerAllEntityTypes(store *file.Store) {
    // Core entities
    store.RegisterEntityType("system", func() persistence.Entity {
        return &oapi.System{}
    })
    store.RegisterEntityType("deployment", func() persistence.Entity {
        return &oapi.Deployment{}
    })
    store.RegisterEntityType("environment", func() persistence.Entity {
        return &oapi.Environment{}
    })
    store.RegisterEntityType("resource", func() persistence.Entity {
        return &oapi.Resource{}
    })
    store.RegisterEntityType("job-agent", func() persistence.Entity {
        return &oapi.JobAgent{}
    })

    // Releases and jobs
    store.RegisterEntityType("release", func() persistence.Entity {
        return &oapi.Release{}
    })
    store.RegisterEntityType("job", func() persistence.Entity {
        return &oapi.Job{}
    })
    store.RegisterEntityType("release-target", func() persistence.Entity {
        return &oapi.ReleaseTarget{}
    })

    // Other entities
    store.RegisterEntityType("policy", func() persistence.Entity {
        return &oapi.Policy{}
    })
    store.RegisterEntityType("relationship-rule", func() persistence.Entity {
        return &oapi.RelationshipRule{}
    })
    // ... etc
}
```

## Performance Characteristics

- **Write**: O(1) - append to file
- **Read**: O(n) - scan entire file, compact in memory
- **Compaction**: O(n) - rewrite entire file
- **Space**: Grows over time without manual compaction

### Compaction Strategy

Files grow with each write. Recommend compacting periodically:

```go
// Compact on a schedule
go func() {
    ticker := time.NewTicker(1 * time.Hour)
    for range ticker.C {
        namespaces, _ := store.ListNamespaces()
        for _, ns := range namespaces {
            if err := store.Compact(ctx, ns); err != nil {
                log.Errorf("Failed to compact %s: %v", ns, err)
            }
        }
    }
}()
```

## When to Use

**Good for:**

- Development and testing
- Small to medium datasets (< 100k entities per namespace)
- Single-instance deployments
- Simple backup/restore needs
- Human-readable persistence

**Not ideal for:**

- High-write workloads (files grow quickly)
- Distributed systems (no built-in sync)
- Very large datasets (compaction becomes expensive)
- Production high-availability (use Kafka or database)

## Comparison with Other Stores

| Feature        | File Store            | Memory Store    | Kafka Store       |
| -------------- | --------------------- | --------------- | ----------------- |
| Persistence    | ✅ Disk               | ❌ RAM only     | ✅ Distributed    |
| External Deps  | ✅ None               | ✅ None         | ❌ Kafka required |
| Compaction     | Manual + auto on load | Auto in-memory  | Auto (Kafka)      |
| Multi-instance | ❌ File locks         | ❌ Process only | ✅ Distributed    |
| Human-readable | ✅ JSONL              | N/A             | ❌ Binary         |
| Performance    | Medium                | Fast            | Fast              |

## Examples

### Backup/Restore

```go
// Backup
src, _ := file.NewStore("./data/live")
backup, _ := file.NewStore("./data/backup")

namespaces, _ := src.ListNamespaces()
for _, ns := range namespaces {
    changes, _ := src.Load(ctx, ns)
    backup.Save(ctx, changes)
}

// Restore
changes, _ := backup.Load(ctx, "workspace-1")
live.Save(ctx, changes)
```

### Migration from Memory to File

```go
// Existing memory store
memStore := memory.NewStore()

// New file store
fileStore, _ := file.NewStore("./data")

// Migrate
changes, _ := memStore.Load(ctx, "workspace-1")
fileStore.Save(ctx, changes)
```

### Union with Kafka for Redundancy

```go
import "workspace-engine/pkg/persistence/union"

kafkaStore := kafka.NewStore(...)
fileStore, _ := file.NewStore("./backup")

// Save to both, load from either
redundantStore := union.New(kafkaStore, fileStore)

manager.Configure(
    manager.WithPersistentStore(redundantStore),
)
```
