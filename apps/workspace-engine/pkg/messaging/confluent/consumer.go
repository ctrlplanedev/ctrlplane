package confluent

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/messaging"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// Consumer is a Confluent Kafka implementation of messaging.Consumer
type Consumer struct {
	consumer           *kafka.Consumer
	topic              string
	assignedPartitions []int32
	closed             bool
}

// Ensure Consumer implements messaging.Consumer
var _ messaging.Consumer = (*Consumer)(nil)

// NewConsumer creates a new Confluent Kafka consumer
func NewConsumer(brokers string, groupID string, topic string, config *kafka.ConfigMap) (*Consumer, error) {
	log.Info("Creating Confluent Kafka consumer", "brokers", brokers, "groupID", groupID)

	// Default configuration
	if config == nil {
		config = &kafka.ConfigMap{
			"bootstrap.servers":               brokers,
			"group.id":                        groupID,
			"auto.offset.reset":               "earliest",
			"enable.auto.commit":              false,
			"partition.assignment.strategy":   "cooperative-sticky",
			"session.timeout.ms":              3000, // Minimum for dev (faster coordinator join)
			"heartbeat.interval.ms":           1000, // Fast heartbeats for quick detection
			"go.application.rebalance.enable": true, // Enable rebalance callbacks
		}
	} else {
		// Ensure required fields are set
		if _, exists := (*config)["bootstrap.servers"]; !exists {
			(*config)["bootstrap.servers"] = brokers
		}
		if _, exists := (*config)["group.id"]; !exists {
			(*config)["group.id"] = groupID
		}
	}

	c, err := kafka.NewConsumer(config)
	if err != nil {
		log.Error("Failed to create Confluent Kafka consumer", "error", err)
		return nil, err
	}

	consumer := &Consumer{
		consumer: c,
		closed:   false,
		topic:    topic,
	}

	if err := consumer.subscribe(); err != nil {
		return nil, err
	}

	return consumer, nil
}

// Subscribe subscribes to a topic
func (c *Consumer) subscribe() error {
	if c.closed {
		return fmt.Errorf("consumer is closed")
	}

	log.Info("Subscribing to Kafka topic", "topic", c.topic)
	if err := c.consumer.SubscribeTopics([]string{c.topic}, nil); err != nil {
		log.Error("Failed to subscribe", "error", err)
		return err
	}

	log.Info("Successfully subscribed to topic", "topic", c.topic)

	// Wait for partition assignment with extended timeout
	// Kafka coordinator election and initial rebalance can take time
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	partitions, err := c.waitForPartitionAssignment(ctx)
	if err != nil {
		return fmt.Errorf("failed to wait for partition assignment: %w", err)
	}

	c.assignedPartitions = partitions
	log.Info("Partition assignment complete", "assigned", partitions)

	return nil
}

// waitForPartitionAssignment blocks until Kafka assigns partitions to this consumer
func (c *Consumer) waitForPartitionAssignment(ctx context.Context) ([]int32, error) {
	startTime := time.Now()
	log.Info("Waiting for partition assignment from Kafka coordinator...")
	log.Info("This process involves: 1) Joining consumer group, 2) Coordinator election (if first consumer), 3) Partition rebalance")

	// Check current assignment
	assignment, err := c.consumer.Assignment()
	if err != nil {
		log.Error("Failed to get assignment", "error", err)
	} else if len(assignment) > 0 {
		partitions := extractPartitionNumbers(assignment)
		log.Info("Partitions already assigned", "partitions", partitions, "duration", time.Since(startTime))
		return partitions, nil
	}

	pollCount := 0
	var assignedPartitions []int32
	lastLogTime := time.Now()

	for {
		select {
		case <-ctx.Done():
			log.Error("Context cancelled while waiting for partition assignment",
				"duration", time.Since(startTime),
				"pollCount", pollCount,
				"error", ctx.Err())
			log.Error("Partition assignment timeout - possible causes: 1) Kafka broker unreachable, 2) Network issues, 3) Slow coordinator election")
			return nil, fmt.Errorf("timeout waiting for partition assignment: %w", ctx.Err())
		default:
			ev := c.consumer.Poll(200)
			pollCount++

			// Log progress every 5 seconds
			if time.Since(lastLogTime) >= 5*time.Second {
				elapsed := time.Since(startTime)
				log.Info("Still waiting for partition assignment...",
					"elapsed", elapsed.Round(time.Second),
					"polls", pollCount,
					"status", "waiting_for_coordinator")
				lastLogTime = time.Now()
			}

			if ev == nil {
				// If we have partitions assigned and waited a few polls, we're done
				if len(assignedPartitions) > 0 && pollCount > 5 {
					log.Info("Assignment stable, proceeding",
						"partitions", assignedPartitions,
						"duration", time.Since(startTime).Round(time.Second))
					return assignedPartitions, nil
				}

				currentAssignment, err := c.consumer.Assignment()
				if err == nil && len(currentAssignment) > 0 {
					partitions := extractPartitionNumbers(currentAssignment)
					log.Info("Detected assignment outside of events", "partitions", partitions)
					return partitions, nil
				}

				continue
			}

			switch e := ev.(type) {
			case kafka.AssignedPartitions:
				elapsed := time.Since(startTime)
				log.Info("✓ Received AssignedPartitions event",
					"partitions", extractPartitionNumbers(e.Partitions),
					"timeToAssign", elapsed.Round(time.Second))

				if err := c.consumer.IncrementalAssign(e.Partitions); err != nil {
					log.Error("IncrementalAssign failed", "error", err)
					return nil, fmt.Errorf("incremental assign failed: %w", err)
				}

				assignedPartitions = append(assignedPartitions, extractPartitionNumbers(e.Partitions)...)
				log.Info("Partitions assigned successfully",
					"total_partitions", len(assignedPartitions),
					"partitions", assignedPartitions,
					"duration", elapsed.Round(time.Second))

			case kafka.RevokedPartitions:
				log.Warn("Received RevokedPartitions event", "partitions", extractPartitionNumbers(e.Partitions))
				if err := c.consumer.IncrementalUnassign(e.Partitions); err != nil {
					log.Warn("IncrementalUnassign failed", "error", err)
				}

				// Remove revoked partitions from our list
				revokedSet := make(map[int32]bool)
				for _, p := range extractPartitionNumbers(e.Partitions) {
					revokedSet[p] = true
				}
				var remaining []int32
				for _, p := range assignedPartitions {
					if !revokedSet[p] {
						remaining = append(remaining, p)
					}
				}
				assignedPartitions = remaining
				log.Info("Partitions after revoke", "partitions", assignedPartitions)

			case kafka.Error:
				log.Error("Received Kafka error while waiting for assignment", "error", e)
				return nil, fmt.Errorf("consumer error while waiting for assignment: %w", e)
			}
		}
	}
}

// extractPartitionNumbers converts Kafka TopicPartition array to simple partition number array
func extractPartitionNumbers(assignment []kafka.TopicPartition) []int32 {
	partitions := make([]int32, len(assignment))
	for i, tp := range assignment {
		partitions[i] = tp.Partition
	}
	return partitions
}

// ReadMessage reads the next message with a timeout
// Returns ErrTimeout if no message is available within the timeout duration
func (c *Consumer) ReadMessage(timeout time.Duration) (*messaging.Message, error) {
	if c.closed {
		return nil, fmt.Errorf("consumer is closed")
	}

	msg, err := c.consumer.ReadMessage(timeout)
	if err != nil {
		// Check if it's a timeout error
		if kafkaErr, ok := err.(kafka.Error); ok {
			if kafkaErr.Code() == kafka.ErrTimedOut {
				return nil, messaging.ErrTimeout
			}
		}
		return nil, fmt.Errorf("error reading message: %w", err)
	}

	// Convert kafka.Message to messaging.Message
	return &messaging.Message{
		Key:       msg.Key,
		Value:     msg.Value,
		Partition: msg.TopicPartition.Partition,
		Offset:    int64(msg.TopicPartition.Offset),
		Timestamp: msg.Timestamp,
	}, nil
}

// CommitMessage commits the offset for a message
func (c *Consumer) CommitMessage(msg *messaging.Message) error {
	if c.closed {
		return fmt.Errorf("consumer is closed")
	}

	kafkaMsg := &kafka.Message{
		TopicPartition: kafka.TopicPartition{
			Topic:     &c.topic,
			Partition: msg.Partition,
			Offset:    kafka.Offset(msg.Offset),
		},
		Key:       msg.Key,
		Value:     msg.Value,
		Timestamp: msg.Timestamp,
	}

	_, err := c.consumer.CommitMessage(kafkaMsg)
	if err != nil {
		return fmt.Errorf("failed to commit message: %w", err)
	}

	log.Debug("Offset committed", "partition", msg.Partition, "offset", msg.Offset)
	return nil
}

// GetCommittedOffset gets the last committed offset for a partition
func (c *Consumer) GetCommittedOffset(partition int32) (int64, error) {
	if c.closed {
		return 0, fmt.Errorf("consumer is closed")
	}

	partitions := []kafka.TopicPartition{
		{
			Topic:     &c.topic,
			Partition: partition,
			Offset:    kafka.OffsetStored, // This fetches the committed offset
		},
	}

	committed, err := c.consumer.Committed(partitions, 5000)
	if err != nil {
		return int64(kafka.OffsetInvalid), fmt.Errorf("failed to get committed offset: %w", err)
	}

	if len(committed) == 0 || committed[0].Offset == kafka.OffsetInvalid {
		// No committed offset yet, this is the beginning
		return int64(kafka.OffsetBeginning), nil
	}

	return int64(committed[0].Offset), nil
}

// SeekToOffset seeks to a specific offset for a partition
func (c *Consumer) SeekToOffset(partition int32, offset int64) error {
	if c.closed {
		return fmt.Errorf("consumer is closed")
	}

	err := c.consumer.Seek(kafka.TopicPartition{
		Topic:     &c.topic,
		Partition: partition,
		Offset:    kafka.Offset(offset),
	}, 5000)

	if err != nil {
		return fmt.Errorf("failed to seek to offset: %w", err)
	}

	log.Debug("Seeked to offset", "partition", partition, "offset", offset)
	return nil
}

// GetAssignedPartitions returns the partitions assigned to this consumer
func (c *Consumer) GetAssignedPartitions() ([]int32, error) {
	if c.closed {
		return nil, fmt.Errorf("consumer is closed")
	}

	return c.assignedPartitions, nil
}

// GetPartitionCount returns the total number of partitions for the subscribed topic
func (c *Consumer) GetPartitionCount() (int32, error) {
	if c.closed {
		return 0, fmt.Errorf("consumer is closed")
	}

	if c.topic == "" {
		return 0, fmt.Errorf("consumer not subscribed to any topic")
	}

	metadata, err := c.consumer.GetMetadata(&c.topic, false, 5000)
	if err != nil {
		return 0, fmt.Errorf("failed to get topic metadata: %w", err)
	}

	topicMetadata, ok := metadata.Topics[c.topic]
	if !ok {
		return 0, fmt.Errorf("topic %s not found in metadata", c.topic)
	}

	numPartitions := int32(len(topicMetadata.Partitions))
	log.Info("Topic partition count", "topic", c.topic, "partitions", numPartitions)

	return numPartitions, nil
}

// Close closes the consumer
func (c *Consumer) Close() error {
	if c.closed {
		return nil
	}

	if err := c.consumer.Close(); err != nil {
		return fmt.Errorf("failed to close consumer: %w", err)
	}

	c.closed = true
	log.Info("Confluent Kafka consumer closed")
	return nil
}
