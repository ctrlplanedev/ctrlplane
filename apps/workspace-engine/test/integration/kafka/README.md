# Kafka Integration Test Mock

This package provides a realistic Kafka mock for integration testing of the workspace-engine. It wraps the `confluent-kafka-go` MockCluster to provide a simple, easy-to-use API for testing Kafka-related functionality.

## Features

- **Realistic Kafka Behavior**: Uses the official confluent-kafka-go MockCluster
- **Multiple Partitions**: Test partition assignment and key-based routing
- **Offset Management**: Test offset commits, seeks, and resumption
- **Batch Operations**: Easily produce multiple events at once
- **Simple API**: Clean, easy-to-use helper functions
- **Automatic Cleanup**: Proper resource management with `Close()`

## Basic Usage

### Creating a Mock Cluster

```go
func TestMyFeature(t *testing.T) {
    mock := NewMockKafkaCluster(t)
    defer mock.Close()

    // Your test code here
}
```

### Producing Events

```go
// Single event
err := mock.ProduceEvent(
    string(handler.ResourceCreate),
    "workspace-1",
    map[string]string{"key": "value"},
)

// Batch of events
events := []EventData{
    {
        EventType:   string(handler.ResourceCreate),
        WorkspaceID: "workspace-1",
        Data:        map[string]string{"type": "resource1"},
    },
    {
        EventType:   string(handler.ResourceUpdate),
        WorkspaceID: "workspace-1",
        Data:        map[string]string{"type": "resource2"},
    },
}
err := mock.ProduceBatch(events)
```

### Consuming Events

```go
ctx := context.Background()

// Setup consumer with subscription and partition assignment
consumer, partitions, err := mock.SetupConsumerWithSubscription(ctx)
require.NoError(t, err)
defer consumer.Close()

// Consume single message
msg, err := mock.ConsumeMessage(consumer, 5*time.Second)
require.NoError(t, err)

// Consume multiple messages
messages, err := mock.ConsumeMessages(consumer, 3, 10*time.Second)
require.NoError(t, err)

// Parse event
event, err := mock.ParseEvent(msg)
require.NoError(t, err)
assert.Equal(t, handler.ResourceCreate, event.EventType)
```

### Offset Management

```go
// Commit offset
err := mock.CommitOffset(consumer, msg)
require.NoError(t, err)

// Get committed offset
offset, err := mock.GetCommittedOffset(consumer, partition)
require.NoError(t, err)

// Seek to specific offset
err := mock.SeekToOffset(consumer, partition, 42)
require.NoError(t, err)
```

## Configuration Options

You can customize the mock cluster using functional options:

```go
mock := NewMockKafkaCluster(t,
    WithTopic("custom-topic"),
    WithPartitions(5),
    WithGroupID("custom-group"),
)
defer mock.Close()
```

### Available Options

- `WithTopic(topic string)`: Set custom topic name (default: "test-workspace-events")
- `WithPartitions(count int)`: Set number of partitions (default: 3)
- `WithGroupID(groupID string)`: Set consumer group ID (default: "test-consumer-group")

## Testing Patterns

### Testing Event Processing

```go
func TestEventProcessing(t *testing.T) {
    mock := NewMockKafkaCluster(t)
    defer mock.Close()

    ctx := context.Background()

    // Setup consumer
    consumer, _, err := mock.SetupConsumerWithSubscription(ctx)
    require.NoError(t, err)
    defer consumer.Close()

    // Produce event
    err = mock.ProduceEvent(string(handler.ResourceCreate), "workspace-1", myData)
    require.NoError(t, err)

    // Consume and process
    msg, err := mock.ConsumeMessage(consumer, 5*time.Second)
    require.NoError(t, err)

    event, err := mock.ParseEvent(msg)
    require.NoError(t, err)

    // Process event and assert results
    result := processEvent(event)
    assert.Equal(t, expectedResult, result)

    // Verify message count
    mock.AssertMessageCount(1)
}
```

### Testing Offset Resume After Restart

```go
func TestOffsetResume(t *testing.T) {
    mock := NewMockKafkaCluster(t)
    defer mock.Close()

    ctx := context.Background()

    // First consumer session - consume and commit some messages
    consumer1, partitions, err := mock.SetupConsumerWithSubscription(ctx)
    require.NoError(t, err)

    partition := partitions[0].Partition

    // Produce 5 messages
    for i := 0; i < 5; i++ {
        mock.ProduceEvent(string(handler.ResourceCreate), "workspace-1", map[string]int{"index": i})
    }

    // Consume first 3
    messages, _ := mock.ConsumeMessages(consumer1, 3, 10*time.Second)
    mock.CommitOffset(consumer1, messages[2])
    consumer1.Close()

    // Second consumer session - should resume from offset 3
    consumer2, err := mock.CreateConsumer()
    require.NoError(t, err)
    defer consumer2.Close()

    mock.SubscribeConsumer(consumer2)
    mock.WaitForPartitionAssignment(consumer2, 5*time.Second)

    // Should get remaining 2 messages
    remaining, err := mock.ConsumeMessages(consumer2, 2, 10*time.Second)
    require.NoError(t, err)
    assert.Len(t, remaining, 2)
}
```

### Testing Multiple Partitions and Key Routing

```go
func TestPartitioning(t *testing.T) {
    mock := NewMockKafkaCluster(t, WithPartitions(5))
    defer mock.Close()

    ctx := context.Background()

    consumer, partitions, err := mock.SetupConsumerWithSubscription(ctx)
    require.NoError(t, err)
    defer consumer.Close()

    assert.Len(t, partitions, 5, "should have 5 partitions")

    // Produce messages for different workspaces
    // Same workspace ID (key) should always go to same partition
    for i := 0; i < 10; i++ {
        workspaceID := fmt.Sprintf("workspace-%d", i%3)
        mock.ProduceEvent(string(handler.ResourceCreate), workspaceID, nil)
    }

    // Consume and verify partition consistency
    messages, err := mock.ConsumeMessages(consumer, 10, 10*time.Second)
    require.NoError(t, err)

    partitionMap := make(map[string]int32)
    for _, msg := range messages {
        key := string(msg.Key)
        if partition, exists := partitionMap[key]; exists {
            assert.Equal(t, partition, msg.TopicPartition.Partition)
        } else {
            partitionMap[key] = msg.TopicPartition.Partition
        }
    }
}
```

### Testing with Custom Producer/Consumer

```go
func TestCustomProducer(t *testing.T) {
    mock := NewMockKafkaCluster(t)
    defer mock.Close()

    // Create your own producer for more control
    producer, err := mock.CreateProducer()
    require.NoError(t, err)
    defer producer.Close()

    // Use the producer
    err = mock.ProduceEventWithProducer(producer,
        string(handler.ResourceCreate),
        "workspace-1",
        myData,
    )
    require.NoError(t, err)
}
```

## Integration with Workspace Engine Tests

You can use this mock alongside the existing workspace engine test infrastructure:

```go
func TestWorkspaceWithKafka(t *testing.T) {
    // Create Kafka mock
    kafkaMock := NewMockKafkaCluster(t)
    defer kafkaMock.Close()

    ctx := context.Background()

    // Create workspace with event producer
    // (adapt to your existing test setup)
    ws := integration.NewTestWorkspace(t,
        integration.WithKafkaProducer(kafkaMock),
    )

    // Setup Kafka consumer
    consumer, _, err := kafkaMock.SetupConsumerWithSubscription(ctx)
    require.NoError(t, err)
    defer consumer.Close()

    // Make changes to workspace
    ws.CreateResource(ctx, myResource)

    // Verify event was produced
    msg, err := kafkaMock.ConsumeMessage(consumer, 5*time.Second)
    require.NoError(t, err)

    event, _ := kafkaMock.ParseEvent(msg)
    assert.Equal(t, handler.ResourceCreate, event.EventType)
}
```

## API Reference

### MockKafkaCluster

Main struct representing the mock Kafka cluster.

#### Methods

- `CreateProducer() (*kafka.Producer, error)`: Create a new producer
- `CreateConsumer() (*kafka.Consumer, error)`: Create a new consumer
- `ProduceEvent(eventType, workspaceID string, data any) error`: Produce single event
- `ProduceEventWithProducer(producer *kafka.Producer, eventType, workspaceID string, data any) error`: Produce event with specific producer
- `ProduceBatch(events []EventData) error`: Produce multiple events
- `ConsumeMessage(consumer *kafka.Consumer, timeout time.Duration) (*kafka.Message, error)`: Consume single message
- `ConsumeMessages(consumer *kafka.Consumer, count int, timeout time.Duration) ([]*kafka.Message, error)`: Consume multiple messages
- `ParseEvent(msg *kafka.Message) (*handler.RawEvent, error)`: Extract RawEvent from message
- `SubscribeConsumer(consumer *kafka.Consumer) error`: Subscribe consumer to topic
- `WaitForPartitionAssignment(consumer *kafka.Consumer, timeout time.Duration) ([]kafka.TopicPartition, error)`: Wait for partition assignment
- `CommitOffset(consumer *kafka.Consumer, msg *kafka.Message) error`: Commit offset
- `GetCommittedOffset(consumer *kafka.Consumer, partition int32) (int64, error)`: Get committed offset
- `SeekToOffset(consumer *kafka.Consumer, partition int32, offset int64) error`: Seek to offset
- `SetupConsumerWithSubscription(ctx context.Context) (*kafka.Consumer, []kafka.TopicPartition, error)`: Helper to create, subscribe, and wait for assignment
- `GetMessageCount() int`: Get total messages produced
- `AssertMessageCount(expected int)`: Assert expected message count
- `Close()`: Clean up all resources

## Running Tests

```bash
# Run the kafka integration tests
cd apps/workspace-engine
go test ./test/integration/kafka/... -v

# Run specific test
go test ./test/integration/kafka/... -v -run TestMockKafkaCluster_ProduceAndConsume

# Run with race detection
go test ./test/integration/kafka/... -v -race
```

## Best Practices

1. **Always defer Close()**: Ensure proper cleanup of resources

   ```go
   mock := NewMockKafkaCluster(t)
   defer mock.Close()
   ```

2. **Use timeouts**: Always specify reasonable timeouts for consume operations

   ```go
   msg, err := mock.ConsumeMessage(consumer, 5*time.Second)
   ```

3. **Check partition assignment**: Verify partitions are assigned before consuming

   ```go
   consumer, partitions, err := mock.SetupConsumerWithSubscription(ctx)
   require.NotEmpty(t, partitions)
   ```

4. **Commit offsets explicitly**: Don't rely on auto-commit in tests

   ```go
   err := mock.CommitOffset(consumer, msg)
   ```

5. **Verify message counts**: Use `AssertMessageCount()` to catch unexpected behavior
   ```go
   mock.AssertMessageCount(expectedCount)
   ```

## Troubleshooting

### Consumer not receiving messages

- Ensure the consumer is subscribed and partitions are assigned
- Use `SetupConsumerWithSubscription()` helper for proper setup
- Check that events are produced before consuming

### Offset commit issues

- Verify the consumer has `enable.auto.commit: false` (default in this mock)
- Check that you're committing after processing messages
- Use `GetCommittedOffset()` to debug offset state

### Timeout errors

- Increase timeout values if tests are flaky
- Check that the correct number of messages are being produced
- Verify partition assignment completed successfully

## Examples

See `kafka_test.go` for comprehensive examples of all features.
