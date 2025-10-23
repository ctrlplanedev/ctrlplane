package kafka

import (
	"context"
	"fmt"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// waitForPartitionAssignment blocks until Kafka assigns partitions to this consumer (or timeout)
func waitForPartitionAssignment(ctx context.Context, c *kafka.Consumer) ([]int32, error) {
	log.Info("Waiting for partition assignment... (entering poll loop)")

	// Check current subscription status
	topics, err := c.Subscription()
	if err != nil {
		log.Error("Failed to get subscription", "error", err)
	} else {
		log.Debug("Current subscription", "topics", topics)
	}

	// Check current assignment (should be empty initially)
	assignment, err := c.Assignment()
	if err != nil {
		log.Error("Failed to get assignment", "error", err)
	} else {
		log.Info("Current assignment", "partitions", len(assignment))
		// If we already have an assignment, return it immediately
		if len(assignment) > 0 {
			partitions := extractPartitionNumbers(assignment)
			log.Info("Partitions already assigned, skipping wait", "partitions", partitions)
			return partitions, nil
		}
	}

	pollCount := 0
	var assignedPartitions []int32

	for {
		select {
		case <-ctx.Done():
			log.Error("Context cancelled while waiting for partition assignment")
			return nil, fmt.Errorf("timeout waiting for partition assignment: %w", ctx.Err())
		default:
			ev := c.Poll(200)
			pollCount++
			if pollCount%40 == 0 { // Every ~8s
				log.Info("Polling for partition assignment...", "iteration", pollCount)
			}

			if ev == nil {
				// If we have partitions assigned and waited a few polls, we're done
				if len(assignedPartitions) > 0 && pollCount > 5 {
					log.Info("Assignment stable, proceeding", "partitions", assignedPartitions)
					return assignedPartitions, nil
				}

				currentAssignment, err := c.Assignment()
				if err == nil && len(currentAssignment) > 0 {
					partitions := extractPartitionNumbers(currentAssignment)
					log.Info("Detected assignment outside of events", "partitions", partitions)
					return partitions, nil
				}

				continue
			}

			switch e := ev.(type) {
			case kafka.AssignedPartitions:
				log.Info("Received AssignedPartitions event", "partitions", extractPartitionNumbers(e.Partitions))
				// Using cooperative-sticky strategy - use IncrementalAssign
				log.Debug("Using IncrementalAssign with cooperative-sticky assignment strategy")
				if err := c.IncrementalAssign(e.Partitions); err != nil {
					log.Error("IncrementalAssign failed", "error", err)
					return nil, fmt.Errorf("incremental assign failed: %w", err)
				}

				// Add newly assigned partitions
				assignedPartitions = append(assignedPartitions, extractPartitionNumbers(e.Partitions)...)
				log.Info("Partitions assigned so far", "partitions", assignedPartitions)
				// Don't return immediately - continue polling to ensure rebalance completes

			case kafka.RevokedPartitions:
				log.Warn("Received RevokedPartitions event", "partitions", extractPartitionNumbers(e.Partitions))
				// Using cooperative-sticky strategy - use IncrementalUnassign
				log.Debug("Using IncrementalUnassign for revoke")
				if err := c.IncrementalUnassign(e.Partitions); err != nil {
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
				// Hard errors during group join
				return nil, fmt.Errorf("consumer error while waiting for assignment: %w", e)
			default:
				log.Debug("Poll returned event of unknown type", "type", fmt.Sprintf("%T", e))
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

// getTopicPartitionCount queries Kafka metadata to find total number of partitions for the topic
func getTopicPartitionCount(c *kafka.Consumer) (int32, error) {
	metadata, err := c.GetMetadata(&Topic, false, 5000)
	if err != nil {
		return 0, fmt.Errorf("failed to get topic metadata: %w", err)
	}

	topicMetadata, ok := metadata.Topics[Topic]
	if !ok {
		return 0, fmt.Errorf("topic %s not found in metadata", Topic)
	}

	numPartitions := int32(len(topicMetadata.Partitions))
	log.Info("Topic partition count", "topic", Topic, "partitions", numPartitions)

	return numPartitions, nil
}
