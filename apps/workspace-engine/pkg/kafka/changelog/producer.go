package changelog

import (
	"os"

	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// Configuration variables loaded from environment
var (
	ChangelogTopic   = getEnv("KAFKA_CHANGELOG_TOPIC", "workspace-changelog")
	ChangelogGroupID = getEnv("KAFKA_CHANGELOG_GROUP_ID", "workspace-changelog-consumer")
	Brokers          = getEnv("KAFKA_BROKERS", "localhost:9092")
)

// getEnv retrieves an environment variable or returns a default value
func getEnv(varName string, defaultValue string) string {
	v := os.Getenv(varName)
	if v == "" {
		return defaultValue
	}
	return v
}

// NewChangelogProducer creates a Kafka producer optimized for changelog/compacted topics
// Configuration optimized for:
// - Idempotent writes (exactly-once semantics per partition)
// - Compression for efficiency
// - Reliable delivery with retries
func NewChangelogProducer(brokers string) (messaging.Producer, error) {
	return confluent.NewConfluent(brokers).CreateProducer(ChangelogTopic, &kafka.ConfigMap{
		"bootstrap.servers": brokers,

		// Idempotence ensures exactly-once semantics per partition
		// Critical for changelog topics to prevent duplicates
		"enable.idempotence": true,

		// Compression reduces network and storage overhead
		"compression.type": "snappy",

		// Retry configuration for reliability
		"message.send.max.retries": 10,
		"retry.backoff.ms":         100,

		// Request timeout (30 seconds)
		"request.timeout.ms": 30000,

		// Acks from all in-sync replicas for durability
		// Required when enable.idempotence is true
		"acks": "all",

		// Max in-flight requests per connection
		// Limited to 5 when idempotence is enabled
		"max.in.flight.requests.per.connection": 5,
	})
}

// NewChangelogWriter creates a ChangelogWriter with a new producer
func NewChangelogWriter(brokers string, topic string, numPartitions int32) (*ChangelogWriter, error) {
	producer, err := NewChangelogProducer(brokers)
	if err != nil {
		return nil, err
	}

	return NewWriter(producer, topic, numPartitions), nil
}

// NewChangelogReader creates a ChangelogReader with a new consumer
func NewChangelogReader(brokers string, topic string, groupID string) (*ChangelogReader, error) {
	consumer, err := NewChangelogConsumer(brokers, groupID)
	if err != nil {
		return nil, err
	}

	return NewReader(consumer, topic), nil
}

// NewChangelogReaderForPartitions creates a ChangelogReader that reads from specific partitions
// This is useful when you want to manually control which partitions to read from,
// such as when processing only workspaces that hash to certain partitions
func NewChangelogReaderForPartitions(brokers string, topic string, partitions []int32) (*ChangelogReader, error) {
	// Create consumer with a unique group ID to avoid conflicts
	// Use empty group ID to disable consumer group features
	consumer, err := NewChangelogConsumer(brokers, "")
	if err != nil {
		return nil, err
	}

	reader := NewReaderForPartitions(consumer, topic, partitions)
	return reader, nil
}
