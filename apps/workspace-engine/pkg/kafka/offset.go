package kafka

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/workspace"
	wskafka "workspace-engine/pkg/workspace/kafka"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// loadWorkspaces loads workspaces for the assigned partitions
// Returns the list of assigned partitions
func loadWorkspaces(ctx context.Context, c *kafka.Consumer, assignedPartitions []int32, workspaceLoader workspace.WorkspaceLoader) error {
	if len(assignedPartitions) == 0 {
		log.Info("No partitions assigned to this consumer")
		return nil
	}

	// Get total partition count for the topic
	numPartitions, err := getTopicPartitionCount(c)
	if err != nil {
		return fmt.Errorf("failed to get topic partition count: %w", err)
	}

	// Load workspaces that belong to our assigned partitions
	err = workspaceLoader(ctx, assignedPartitions, numPartitions)
	if err != nil {
		return fmt.Errorf("failed to load workspaces: %w", err)
	}

	return nil
}

// applyOffsets seeks each assigned partition to its stored offset
func applyOffsets(c *kafka.Consumer, assignedPartitions []int32) {
	if len(assignedPartitions) == 0 {
		return
	}

	seekStoredOffsets(c, assignedPartitions)
}

// waitForPartitionAssignment blocks until Kafka assigns partitions to this consumer (or timeout)
func waitForPartitionAssignment(c *kafka.Consumer) ([]int32, error) {
	log.Info("Waiting for partition assignment...")

	timeout := time.After(10 * time.Second)
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-timeout:
			return nil, fmt.Errorf("timeout waiting for partition assignment")

		case <-ticker.C:
			assignment, err := c.Assignment()
			if err != nil {
				return nil, fmt.Errorf("failed to get assignment: %w", err)
			}

			if len(assignment) > 0 {
				partitions := extractPartitionNumbers(assignment)
				log.Info("Partition assignment received", "partitions", partitions)
				return partitions, nil
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

// seekStoredOffsets seeks each assigned partition to its last stored offset from the workspace
func seekStoredOffsets(c *kafka.Consumer, assignedPartitions []int32) {
	seekCount := 0

	for _, partition := range assignedPartitions {
		offset, workspaceID, found := findStoredOffsetForPartition(partition)
		if !found {
			log.Info("No stored offset for partition, will use default",
				"partition", partition)
			continue
		}

		// Seek to the next offset after the last applied one
		seekTo := offset + 1
		err := seekPartition(c, partition, seekTo)
		if err != nil {
			log.Warn("Failed to seek partition",
				"partition", partition,
				"workspace", workspaceID,
				"offset", seekTo,
				"error", err)
			continue
		}

		log.Info("Seeked to stored offset",
			"partition", partition,
			"workspace", workspaceID,
			"offset", seekTo)
		seekCount++
	}

	if seekCount > 0 {
		log.Info("Successfully applied stored offsets", "count", seekCount)
	} else {
		log.Info("No stored offsets to apply")
	}
}

// findStoredOffsetForPartition looks through loaded workspaces to find stored offset for a partition
func findStoredOffsetForPartition(partition int32) (offset int64, workspaceID string, found bool) {
	topicPartition := wskafka.TopicPartition{
		Topic:     Topic,
		Partition: partition,
	}

	// Check all loaded workspaces to find one with offset for this partition
	for _, wsID := range workspace.GetAllWorkspaceIds() {
		ws := workspace.GetWorkspace(wsID)
		if ws == nil {
			continue
		}

		progress, exists := ws.KafkaProgress[topicPartition]
		if exists {
			return progress.LastApplied, ws.ID, true
		}
	}

	return 0, "", false
}

// seekPartition seeks a single partition to a specific offset
func seekPartition(c *kafka.Consumer, partition int32, offset int64) error {
	seekTp := kafka.TopicPartition{
		Topic:     &Topic,
		Partition: partition,
		Offset:    kafka.Offset(offset),
	}
	return c.Seek(seekTp, 0)
}
