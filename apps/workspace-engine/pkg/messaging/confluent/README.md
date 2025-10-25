# Confluent Kafka Messaging Implementation

This package provides a Confluent Kafka implementation of the `messaging.Producer` and `messaging.Consumer` interfaces.

## Features

- **Producer**: Send messages to Kafka topics with automatic partitioning
- **Consumer**: Read messages from Kafka topics with consumer group coordination
- **Configuration**: Flexible configuration with sensible defaults
- **Error Handling**: Comprehensive error handling and logging
- **Thread-Safe**: Safe for concurrent use

## Usage

### Creating a Confluent Factory

```go
import "workspace-engine/pkg/messaging/confluent"

// Create a factory with broker addresses
c := confluent.NewConfluent("localhost:9092")
```

### Producer

#### Basic Producer

```go
// Create a producer for a specific topic
producer, err := c.CreateProducer("my-topic")
if err != nil {
    log.Fatal(err)
}
defer producer.Close()

// Publish a message
key := []byte("my-key")
value := []byte("my-value")
err = producer.Publish(key, value)
if err != nil {
    log.Error("Failed to publish", "error", err)
}

// Flush to ensure all messages are sent
remaining := producer.Flush(5000) // 5 second timeout
if remaining > 0 {
    log.Warn("Messages still pending", "count", remaining)
}
```

#### Producer with Custom Configuration

```go
import "github.com/confluentinc/confluent-kafka-go/v2/kafka"

config := &kafka.ConfigMap{
    "compression.type": "lz4",
    "linger.ms": 100,
}

producer, err := c.CreateProducerWithConfig("my-topic", config)
if err != nil {
    log.Fatal(err)
}
defer producer.Close()
```

### Consumer

#### Basic Consumer

```go
// Create a consumer with a group ID
consumer, err := c.CreateConsumer("my-consumer-group")
if err != nil {
    log.Fatal(err)
}
defer consumer.Close()

// Subscribe to a topic
err = consumer.Subscribe("my-topic")
if err != nil {
    log.Fatal(err)
}

// Read messages
for {
    msg, err := consumer.ReadMessage(1 * time.Second)
    if err != nil {
        log.Error("Error reading message", "error", err)
        continue
    }

    if msg == nil {
        // Timeout - no message available
        continue
    }

    // Process message
    log.Info("Received message", "key", string(msg.Key), "value", string(msg.Value))

    // Commit offset
    err = consumer.CommitMessage(msg)
    if err != nil {
        log.Error("Failed to commit", "error", err)
    }
}
```

#### Consumer with Custom Configuration

```go
config := &kafka.ConfigMap{
    "auto.offset.reset": "latest",
    "session.timeout.ms": 6000,
}

consumer, err := c.CreateConsumerWithConfig("my-consumer-group", config)
if err != nil {
    log.Fatal(err)
}
defer consumer.Close()
```

#### Advanced Consumer Operations

```go
// Get assigned partitions
partitions, err := consumer.GetAssignedPartitions()
if err != nil {
    log.Error("Failed to get partitions", "error", err)
}
log.Info("Assigned partitions", "partitions", partitions)

// Get partition count
count, err := consumer.GetPartitionCount()
if err != nil {
    log.Error("Failed to get partition count", "error", err)
}
log.Info("Partition count", "count", count)

// Get committed offset for a partition
offset, err := consumer.GetCommittedOffset(0)
if err != nil {
    log.Error("Failed to get committed offset", "error", err)
}
log.Info("Committed offset", "offset", offset)

// Seek to specific offset
err = consumer.SeekToOffset(0, 100)
if err != nil {
    log.Error("Failed to seek", "error", err)
}
```

## Default Configuration

### Producer Defaults

- `enable.idempotence`: true
- `compression.type`: snappy
- `message.send.max.retries`: 10
- `retry.backoff.ms`: 100

### Consumer Defaults

- `auto.offset.reset`: earliest
- `enable.auto.commit`: false
- `partition.assignment.strategy`: cooperative-sticky
- `session.timeout.ms`: 10000
- `heartbeat.interval.ms`: 3000
- `go.application.rebalance.enable`: true

## Interface Compliance

This implementation fully complies with the `messaging.Producer` and `messaging.Consumer` interfaces:

```go
type Producer interface {
    Publish(key []byte, value []byte) error
    Flush(timeoutMs int) int
    Close() error
}

type Consumer interface {
    Subscribe(topic string) error
    ReadMessage(timeout time.Duration) (*Message, error)
    CommitMessage(msg *Message) error
    GetCommittedOffset(partition int32) (int64, error)
    SeekToOffset(partition int32, offset int64) error
    GetAssignedPartitions() ([]int32, error)
    GetPartitionCount() (int32, error)
    Close() error
}
```

## Error Handling

All methods return errors that should be checked. Common error scenarios:

- **Connection errors**: Broker unreachable
- **Topic errors**: Topic doesn't exist
- **Timeout errors**: No messages available (ReadMessage returns nil, nil)
- **Commit errors**: Offset commit failed
- **Closed errors**: Operation on closed producer/consumer

## Logging

The implementation uses the `charmbracelet/log` package for logging. Logs include:

- Info: Connection events, subscriptions, assignments
- Debug: Individual message operations
- Warn: Pending messages on close, revoked partitions
- Error: Failed operations, delivery failures

## Testing

Run tests with:

```bash
go test ./pkg/messaging/confluent/...
```

Note: Integration tests require a running Kafka instance and are skipped by default.

## Dependencies

- `github.com/confluentinc/confluent-kafka-go/v2/kafka`
- `github.com/charmbracelet/log`
