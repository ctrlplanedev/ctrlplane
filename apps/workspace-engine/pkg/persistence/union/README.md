# Union Store

A composite persistence store that aggregates multiple stores, saving to all and loading from all with automatic deduplication.

## Overview

The union store implements the `persistence.Store` interface by delegating to multiple underlying stores. This is useful for:

- **Redundancy**: Save to multiple backends for data durability
- **Migration**: Read from old and new stores during migration
- **Federation**: Aggregate data from multiple sources
- **Testing**: Combine in-memory and persistent stores

## Key Features

- **Save to All**: Writes are replicated to all underlying stores
- **Load with Merging**: Reads from all stores and merges results
- **Automatic Compaction**: Keeps only the latest change per entity (by timestamp)
- **Error Handling**: Returns first error but continues operations

## Usage

```go
import (
    "workspace-engine/pkg/persistence/memory"
    "workspace-engine/pkg/persistence/union"
)

// Create multiple stores
store1 := memory.NewStore()
store2 := memory.NewStore()
store3 := memory.NewStore()

// Create union store
unionStore := union.New(store1, store2, store3)

// Save to all stores
changes := persistence.NewChangesBuilder("workspace-1").
    Set(&MyEntity{ID: "e1", Name: "Entity"}).
    Build()

err := unionStore.Save(ctx, changes)
// Changes are now in all 3 stores

// Load from all stores (merged)
loaded, err := unionStore.Load(ctx, "workspace-1")
// Returns deduplicated results from all stores
```

## Behavior

### Save Operation

Saves to all underlying stores sequentially:

```
Union.Save(changes)
  → Store1.Save(changes)
  → Store2.Save(changes)
  → Store3.Save(changes)
```

If any store fails, returns the first error.

### Load Operation

Loads from all stores and merges:

```
Union.Load(namespace)
  → Store1.Load(namespace) → [changes1]
  → Store2.Load(namespace) → [changes2]
  → Store3.Load(namespace) → [changes3]
  → Merge([changes1, changes2, changes3])
  → Return deduplicated results
```

**Deduplication**: For entities with the same `CompactionKey()`, keeps the change with the latest `Timestamp`.

### Close Operation

Closes all stores, returning the first error encountered (but continues closing remaining stores).

## Example: Migration Scenario

```go
// Old store with existing data
oldStore := kafka.NewStore("old-topic")

// New store being migrated to
newStore := kafka.NewStore("new-topic")

// Union store reads from both during migration
migrationStore := union.New(oldStore, newStore)

// Application continues working
manager := persistence.NewManagerBuilder().
    WithStore(migrationStore).
    Build()

// Restore gets data from both stores (merged)
manager.Restore(ctx, "workspace-1")

// Saves go to both stores (redundant during migration)
manager.Persist(ctx, changes)
```

## Example: Redundancy

```go
// Primary and backup stores
primary := postgres.NewStore(primaryDB)
backup := s3.NewStore(s3Client)

// Union ensures writes go to both
redundantStore := union.New(primary, backup)

// If primary fails, can still read from backup
// If backup fails, can still read from primary
```

## Implementation Details

- **Thread Safety**: Depends on underlying stores
- **Performance**: Linear with number of stores (sequential operations)
- **Memory**: Loads all changes into memory for merging
- **Ordering**: No guaranteed order in results (depends on map iteration)

## Limitations

- **Write Latency**: Proportional to number of stores
- **Memory Usage**: Loads all stores' data for merging
- **No Sharding**: All stores receive all data
- **Sequential Ops**: No parallel operations currently
