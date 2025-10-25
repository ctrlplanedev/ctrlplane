package changelog

import (
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// NewChangelogConsumer creates a Kafka consumer optimized for reading changelog/compacted topics
// Transaction mode is set to read-only for safe state rebuilds
func NewChangelogConsumer(brokers string, groupID string) (messaging.Consumer, error) {
	if groupID == "" {
		groupID = ChangelogGroupID
	}

	return confluent.NewConfluent(brokers).CreateConsumer(groupID, &kafka.ConfigMap{
		"bootstrap.servers": brokers,
		"group.id":          groupID,

		// Start from earliest to rebuild full compacted state
		"auto.offset.reset": "earliest",

		// Disable auto-commit for manual control
		"enable.auto.commit": false,

		// Partition assignment strategy for stability
		"partition.assignment.strategy": "cooperative-sticky",

		// Increase session timeout for long operations
		"session.timeout.ms":    45000,
		"heartbeat.interval.ms": 3000,
		"max.poll.interval.ms":  300000,

		"fetch.min.bytes":   1,
		"fetch.wait.max.ms": 500,

		// Enable read-only transaction mode for consumer safety
		// Kafka clients: "isolation.level" controls visibility; "read_committed" for txn support, but for changelog reading, "read_uncommitted" is default and safe
		// To explicitly ensure read-only, set isolation level if applicable. Uncomment below if your Kafka client supports it:
		"isolation.level": "read_committed",
	})
}
