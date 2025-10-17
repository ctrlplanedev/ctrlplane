# Kafka Package

This package handles Kafka message consumption for the workspace engine, with support for partition-based workspace loading and offset resumption.

## File Organization

### `kafka.go`

**Main entry point and configuration**

- `RunConsumer()` - Start consumer without offset resume
- `RunConsumerWithWorkspaceLoader()` - Start consumer with workspace-based offset resume
- Configuration variables (Topic, GroupID, Brokers)

### `consumer.go`

**Consumer lifecycle management**

- `createConsumer()` - Initialize Kafka consumer with configuration

### `message.go`

**Message processing logic**

- `consumeMessages()` - Main message consumption loop
- `processMessage()` - Handle single message (route → track → commit)
- `handleReadError()` - Error handling for read operations

### `offset.go`

**Offset seeking and partition management**

- `loadWorkspacesAndApplyOffsets()` - Main orchestration function
- `waitForPartitionAssignment()` - Wait for Kafka to assign partitions
- `getTopicPartitionCount()` - Query Kafka metadata
- `seekStoredOffsets()` - Seek all partitions to stored offsets
- `findStoredOffsetForPartition()` - Find workspace offset for a partition
- `seekPartition()` - Seek single partition to offset

## Usage

### Basic (No Offset Resume)

```go
ctx := context.Background()
if err := kafka.RunConsumer(ctx); err != nil {
    log.Fatal(err)
}
```

### With Workspace Loading and Offset Resume

```go
ctx := context.Background()

// Create workspace loader
storage := workspace.NewFileStorage("/var/lib/state")
discoverer := func(ctx context.Context) ([]string, error) {
    // Discover workspace IDs
    return workspaceIDs, nil
}
loader := workspace.CreateWorkspaceLoader(storage, discoverer)

// Start consumer with offset resume
if err := kafka.RunConsumerWithWorkspaceLoader(ctx, loader); err != nil {
    log.Fatal(err)
}
```

## Flow

1. **Consumer Initialization** (`consumer.go`)

   - Connect to Kafka brokers
   - Configure consumer group settings
   - Disable auto-commit for manual offset control

2. **Subscription** (`kafka.go`)

   - Subscribe to configured topic
   - Wait for partition assignment

3. **Workspace Loading** (`offset.go`)

   - Wait for Kafka to assign partitions to this consumer
   - Get total partition count from metadata
   - Load workspaces that hash to assigned partitions
   - Seek each partition to stored offset

4. **Message Processing** (`message.go`)
   - Read messages from Kafka
   - Route to appropriate workspace based on workspace ID
   - Track offset in workspace state
   - Commit offset to Kafka

## Key Features

### Partition-Based Workspace Loading

Only loads workspaces that belong to assigned partitions, enabling:

- Horizontal scaling across multiple consumer instances
- Efficient memory usage
- Proper offset tracking per workspace

### Offset Resume

Each workspace tracks its partition's last processed offset:

- On restart, consumer seeks to stored offset
- Avoids reprocessing messages
- Ensures consistency across restarts

### Manual Offset Management

- Offsets tracked in workspace state BEFORE committing
- Manual commits ensure offset reflects actual processing state
- Workspace state can be saved/restored with correct resume point

## Configuration

Environment variables:

- `KAFKA_TOPIC` - Topic to consume (default: "workspace-events")
- `KAFKA_GROUP_ID` - Consumer group ID (default: "workspace-engine")
- `KAFKA_BROKERS` - Comma-separated broker list (default: "localhost:9092")

## Error Handling

- **Timeout errors**: Logged at DEBUG level, consumer continues
- **Consumer errors**: Logged at ERROR level, consumer continues with backoff
- **Processing errors**: Logged at ERROR level, message skipped, consumer continues
- **Seek errors**: Logged at WARN level, partition uses default offset
