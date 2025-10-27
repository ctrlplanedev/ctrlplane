package kafka

import (
	"fmt"
	"time"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// PartitionCounter provides methods to query Kafka topic metadata
type PartitionCounter struct {
	brokers         string
	topic           string
	cachedCount     int32
	lastRefreshed   time.Time
	refreshInterval time.Duration
}

// NewPartitionCounter creates a new PartitionCounter
func NewPartitionCounter(brokers string, topic string) *PartitionCounter {
	return &PartitionCounter{
		brokers:         brokers,
		topic:           topic,
		refreshInterval: 5 * time.Minute,
	}
}

// GetPartitionCount returns the number of partitions for the configured topic
// Uses cached value if within refresh interval
func (pc *PartitionCounter) GetPartitionCount() (int32, error) {
	// Use cached value if still fresh
	if pc.cachedCount > 0 && time.Since(pc.lastRefreshed) < pc.refreshInterval {
		return pc.cachedCount, nil
	}

	// Query Kafka for partition count
	count, err := pc.queryPartitionCount()
	if err != nil {
		// If we have a cached value, use it even if stale
		if pc.cachedCount > 0 {
			log.Warn("Failed to refresh partition count, using cached value",
				"error", err,
				"cached_count", pc.cachedCount,
				"age", time.Since(pc.lastRefreshed))
			return pc.cachedCount, nil
		}
		return 0, err
	}

	// Update cache
	pc.cachedCount = count
	pc.lastRefreshed = time.Now()

	log.Info("Refreshed partition count", "topic", pc.topic, "partitions", count)
	return count, nil
}

// queryPartitionCount queries Kafka for the number of partitions
func (pc *PartitionCounter) queryPartitionCount() (int32, error) {
	// Create an AdminClient to query metadata
	adminClient, err := kafka.NewAdminClient(&kafka.ConfigMap{
		"bootstrap.servers": pc.brokers,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to create admin client: %w", err)
	}
	defer adminClient.Close()

	// Get metadata for the topic
	metadata, err := adminClient.GetMetadata(&pc.topic, false, 5000)
	if err != nil {
		return 0, fmt.Errorf("failed to get topic metadata: %w", err)
	}

	// Find the topic in metadata
	topicMetadata, exists := metadata.Topics[pc.topic]
	if !exists {
		return 0, fmt.Errorf("topic %s not found", pc.topic)
	}

	// Return the number of partitions
	return int32(len(topicMetadata.Partitions)), nil
}

// ForceRefresh forces a refresh of the partition count on next call
func (pc *PartitionCounter) ForceRefresh() {
	pc.lastRefreshed = time.Time{}
}
