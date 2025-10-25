# Persistence Package

## Overview

This package provides a persistence layer with **topic compaction** for storing entity state. It's designed to work with storage backends like Kafka compacted topics or in-memory maps.

## Key Concepts

### 🔑 NOT Reading "From the Beginning of Time"

The most important thing to understand: **this is NOT a full historical changelog**. Instead:

- **Topic Compaction**: Only the latest state per entity is stored
- **Current State**: When you `Load()`, you get the minimal set of changes needed to reconstruct the current state
- **Automatic Deduplication**: The `Apply` function handles duplicates (in case Kafka hasn't compacted yet)

### How It Works

```text
┌─────────────────────────────────────────────────────────────┐
│  Storage (e.g., Kafka Compacted Topic)                      │
│                                                              │
│  Entity A: Create  → Update → Update → [COMPACTED TO] → Update (latest)
│  Entity B: Create  → Delete → [COMPACTED TO] → Delete (latest)
│  Entity C: Create  → [COMPACTED TO] → Create (latest)
│                                                              │
│  What Load() returns: Only the latest change per entity ✓   │
│  NOT the full history ✗                                     │
└─────────────────────────────────────────────────────────────┘
```

## Core Types

### `Changes`

```go
type Changes []Change
```

A collection of changes representing the **current state**. Conceptually, each entity appears at most once with its latest state.

### `Store` Interface

```go
type Store interface {
    Save(ctx context.Context, changes Changes) error
    Load(ctx context.Context, namespace string) (Changes, error)
    Close() error
}
```

- **`Save`**: Persists changes, which will be compacted per entity
- **`Load`**: Returns the current state (may have duplicates if async compaction like Kafka)
- The store uses topic compaction to minimize storage

### `Manager`

Orchestrates loading and applying changes:

- **`Restore(namespace)`**: Loads current state and applies it to repositories
- **`Persist(changes)`**: Saves new changes (will be compacted)

## Example Usage

```go
// Build a manager with repositories
manager := persistence.NewManagerBuilder().
    WithStore(store).
    RegisterRepository("deployment", deploymentRepo).
    RegisterRepository("environment", envRepo).
    Build()

// Create some changes
changes := persistence.NewChangesBuilder("workspace-1").
    Create(&Deployment{ID: "d1", Name: "API"}).
    Update(&Deployment{ID: "d1", Name: "API v2"}).  // Same entity - will compact
    Create(&Environment{ID: "e1", Name: "Prod"}).
    Build()

// Save - only latest state per entity is kept
manager.Persist(ctx, changes)

// Later: Restore from current state (NOT full history)
manager.Restore(ctx, "workspace-1")
// This loads only:
//   - Deployment d1: Update (API v2) - latest state
//   - Environment e1: Create (Prod)   - latest state
```

## Compaction Behavior

### In-Memory Store

The `memory.Store` implementation compacts **immediately**:

- Uses a map: `namespace → (entityType:entityID) → latest change`
- When you save the same entity twice, only the latest is kept

### Kafka Store (Future)

A Kafka-backed store would compact **asynchronously**:

- Kafka's compaction runs in the background
- `Load()` might return duplicates temporarily
- The `Apply` function deduplicates by timestamp automatically

## Why This Design?

1. **Efficient Storage**: Don't store full history, only current state
2. **Fast Restore**: Read minimal data to reconstruct state
3. **Kafka-Compatible**: Works naturally with Kafka compacted topics
4. **Flexible Backend**: Can swap in-memory, Kafka, or other stores

## Common Pitfalls

❌ **Wrong**: Thinking `Load()` reads all historical events  
✅ **Right**: `Load()` returns only the current state per entity

❌ **Wrong**: Expecting Create + Update to both be applied  
✅ **Right**: Only the latest change (Update) is applied after compaction

❌ **Wrong**: Worrying about duplicates in the result  
✅ **Right**: The `Apply` function handles deduplication automatically
