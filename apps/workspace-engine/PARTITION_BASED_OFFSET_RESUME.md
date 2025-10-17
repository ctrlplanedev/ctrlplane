# Partition-Based Offset Resume

This document explains how workspace offset tracking works with Kafka partitions and how to implement offset resumption correctly.

## Architecture Overview

The workspace engine uses **consistent hashing** to route workspace events to specific Kafka partitions:

```
Workspace ID → Murmur3 Hash → Partition Number
```

This ensures:

- All events for a workspace go to the **same partition**
- Multiple consumer instances can split partitions for horizontal scaling
- Each workspace's state is independent and can be loaded/saved separately

## Key Concepts

### 1. Workspace-to-Partition Mapping

```go
partition := kafka.PartitionForWorkspace(workspaceID, numPartitions)
```

This uses the same Murmur3 hashing as the producer to determine which partition contains events for a given workspace.

### 2. Partition Assignment

When a consumer starts:

- Kafka assigns specific partitions to this consumer instance
- If there are multiple consumers in the group, each gets a subset of partitions
- The consumer only needs to load workspaces that hash to its assigned partitions

### 3. Offset Tracking Per Workspace

Each workspace tracks its own Kafka offset in `KafkaProgress`:

- `LastApplied`: The offset of the last successfully processed message
- `LastTimestamp`: Timestamp of the last message
- Stored as part of the workspace state (in `.gob` files)

## Usage Example

### Step 1: Implement Workspace ID Discovery

```go
package main

import (
    "context"
    "os"
    "path/filepath"
    "strings"
    "workspace-engine/pkg/workspace"
)

// discoverWorkspaceIDsFromDisk lists all .gob files in storage
func discoverWorkspaceIDsFromDisk(stateDir string) workspace.WorkspaceIDDiscoverer {
    return func(ctx context.Context) ([]string, error) {
        entries, err := os.ReadDir(stateDir)
        if err != nil {
            if os.IsNotExist(err) {
                return []string{}, nil
            }
            return nil, err
        }

        var workspaceIDs []string
        for _, entry := range entries {
            if entry.IsDir() {
                continue
            }

            // Extract workspace ID from filename (e.g., "workspace-123.gob" → "workspace-123")
            filename := entry.Name()
            if strings.HasSuffix(filename, ".gob") {
                workspaceID := strings.TrimSuffix(filename, ".gob")
                workspaceIDs = append(workspaceIDs, workspaceID)
            }
        }

        return workspaceIDs, nil
    }
}

// Or discover from database
func discoverWorkspaceIDsFromDB(db *sql.DB) workspace.WorkspaceIDDiscoverer {
    return func(ctx context.Context) ([]string, error) {
        rows, err := db.QueryContext(ctx, "SELECT DISTINCT workspace_id FROM workspaces")
        if err != nil {
            return nil, err
        }
        defer rows.Close()

        var workspaceIDs []string
        for rows.Next() {
            var id string
            if err := rows.Scan(&id); err != nil {
                return nil, err
            }
            workspaceIDs = append(workspaceIDs, id)
        }

        return workspaceIDs, nil
    }
}
```

### Step 2: Create Workspace Loader

```go
package main

import (
    "workspace-engine/pkg/kafka"
    "workspace-engine/pkg/workspace"
)

func main() {
    ctx := context.Background()

    // Setup storage
    stateDir := "/var/lib/workspace-engine/state"
    storage := workspace.NewFileStorage(stateDir)

    // Create workspace ID discoverer
    discoverer := discoverWorkspaceIDsFromDisk(stateDir)

    // Create workspace loader
    workspaceLoader := workspace.CreateWorkspaceLoader(
        storage,
        discoverer,
        kafka.PartitionForWorkspace, // Use the same hash function as producer
    )

    // Start Kafka consumer with workspace loading
    go func() {
        if err := kafka.RunConsumerWithWorkspaceLoader(ctx, workspaceLoader); err != nil {
            log.Error("Kafka consumer error", "error", err)
        }
    }()

    // ... rest of application
}
```

### Step 3: Periodic Workspace Saving

```go
// Save workspace state periodically
go func() {
    ticker := time.NewTicker(5 * time.Minute)
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            saveAllWorkspaces(ctx, storage)
        }
    }
}()

func saveAllWorkspaces(ctx context.Context, storage workspace.StorageClient) {
    for _, id := range workspace.GetAllWorkspaceIds() {
        ws := workspace.GetWorkspace(id)
        if ws == nil {
            continue
        }

        path := fmt.Sprintf("%s.gob", id)
        if err := ws.SaveToStorage(ctx, storage, path); err != nil {
            log.Error("Failed to save workspace", "id", id, "error", err)
        }
    }
    log.Info("Saved all workspace states")
}
```

## How It Works

### On Consumer Startup

1. **Subscribe to topic** and wait for partition assignment
2. **Get total partition count** from Kafka metadata
3. **Discover all workspace IDs** (from disk, database, etc.)
4. **For each workspace ID**:
   - Calculate: `partition = hash(workspaceID) % numPartitions`
   - If `partition` is in our assigned partitions:
     - Load workspace from storage
     - Register it globally
     - Store in `workspacesByPartition` map
5. **For each loaded workspace**:
   - Check if it has stored Kafka offset for its partition
   - If yes: `Seek(partition, lastApplied + 1)`
   - If no: Use default (committed offset or `earliest`)

### During Message Processing

```go
msg := consumer.ReadMessage()
ws := handler.ListenAndRoute(ctx, msg) // Routes to workspace based on msg.WorkspaceID

// Track offset per partition BEFORE committing
ws.KafkaProgress.FromMessage(msg)

consumer.CommitMessage(msg)
```

### Example Scenario

**Setup:**

- Topic has 3 partitions: P0, P1, P2
- Workspaces: W1, W2, W3, W4, W5
- 2 consumer instances: C1, C2

**Partition Assignment (by Kafka):**

- C1 gets: [P0, P1]
- C2 gets: [P2]

**Workspace Hashing:**

- W1 → P0
- W2 → P1
- W3 → P2
- W4 → P0
- W5 → P1

**What Each Consumer Loads:**

- C1 loads: W1, W2, W4, W5 (hash to P0 or P1)
- C2 loads: W3 (hashes to P2)

**Offset Seeking:**

- C1 seeks P0 to W1's offset (or W4's if higher)
- C1 seeks P1 to W2's offset (or W5's if higher)
- C2 seeks P2 to W3's offset

## Handling Multiple Workspaces Per Partition

If multiple workspaces hash to the same partition, the system currently uses the **first** workspace found for that partition.

**Important Consideration:** Since all workspaces on the same partition see the same messages (in order), they should all have the same offset for that partition. If they differ, it indicates:

- One workspace was saved more recently
- Messages were lost or skipped

**Solution:** Use the **minimum** offset if you want to reprocess for consistency, or **maximum** if you trust the most recent state.

Current implementation uses the workspace that happens to be assigned to that partition key in the map. Consider modifying if you need specific behavior:

```go
// In CreateWorkspaceLoader, modify the assignment logic:
if existingWs, exists := workspacesByPartition[partition]; exists {
    // Decide policy: use min offset, max offset, or first found
    // Current: overwrites with latest (last one wins)
}
workspacesByPartition[partition] = ws
```

## Benefits

### 1. Efficient Memory Usage

- Only load workspaces for assigned partitions
- Don't waste memory on workspaces handled by other consumers

### 2. Horizontal Scalability

- Add more consumer instances to split partition load
- Each consumer independently manages its assigned workspaces

### 3. Partition Rebalancing

- When consumers join/leave, Kafka rebalances partitions
- On rebalance, the new partition assignment triggers workspace loading
- Old workspaces are saved, new ones are loaded automatically

### 4. Independent State Management

- Each workspace's state is independent
- Can rebuild/reset individual workspaces without affecting others

## Testing

```go
package main

import (
    "testing"
    "workspace-engine/pkg/kafka"
)

func TestPartitionMapping(t *testing.T) {
    numPartitions := int32(3)

    // Test consistent hashing
    ws1 := "workspace-1"
    p1 := kafka.PartitionForWorkspace(ws1, numPartitions)

    // Same workspace should always map to same partition
    for i := 0; i < 100; i++ {
        if kafka.PartitionForWorkspace(ws1, numPartitions) != p1 {
            t.Errorf("Inconsistent partition assignment for %s", ws1)
        }
    }

    // Partition should be in valid range
    if p1 < 0 || p1 >= numPartitions {
        t.Errorf("Invalid partition %d for %d partitions", p1, numPartitions)
    }
}
```

## Troubleshooting

### Consumer doesn't seek to stored offsets

**Check:**

1. Workspace loader is provided to `RunConsumerWithWorkspaceLoader`
2. Workspace IDs are discovered correctly
3. Workspace files exist in storage directory
4. Partition hashing matches producer-side hashing

**Debug logs to look for:**

```
Partition assignment received partitions=X
Loaded workspaces for partitions count=Y
Seeked to stored offset partition=Z workspace=W offset=O
```

### Wrong workspaces loaded

**Verify:**

```go
// Test which partition a workspace should go to
partition := kafka.PartitionForWorkspace("your-workspace-id", numPartitions)
fmt.Printf("Workspace maps to partition: %d\n", partition)
```

### Multiple workspaces on same partition

This is normal and expected. The system will use one workspace's offset for the partition. Ensure all workspaces on the same partition are saved together.

## Migration from Old System

If you're migrating from the old `CollectAllKafkaOffsets` approach:

1. Keep existing workspace `.gob` files - they contain the offset data
2. Implement `WorkspaceIDDiscoverer` to find your workspaces
3. Use `CreateWorkspaceLoader` with your discoverer
4. Change `RunConsumerWithOffsets` → `RunConsumerWithWorkspaceLoader`

The offset data in `workspace.KafkaProgress` is compatible - no data migration needed.
