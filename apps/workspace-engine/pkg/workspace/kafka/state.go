package kafka

import (
	"context"
	"workspace-engine/pkg/db"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"github.com/spaolacci/murmur3"
)

type TopicPartition struct {
	Topic     string
	Partition int32
}

type KafkaProgress struct {
	// Last offset you have durably applied to your state.
	// Resume at Offset+1 on restart.
	LastApplied int64

	// Optional: last message timestamp or watermark if you want metrics.
	LastTimestamp int64
}

type KafkaProgressMap map[TopicPartition]KafkaProgress

func (m KafkaProgressMap) FromMessage(msg *kafka.Message) {
	topicPartition := TopicPartition{
		Topic:     *msg.TopicPartition.Topic,
		Partition: int32(msg.TopicPartition.Partition),
	}

	m[topicPartition] = KafkaProgress{
		LastApplied:   int64(msg.TopicPartition.Offset),
		LastTimestamp: int64(msg.Timestamp.Unix()),
	}
}

// PartitionForWorkspace computes which partition a workspace ID should be routed to
// using Murmur3 hash (Kafka-compatible partitioning)
func PartitionForWorkspace(workspaceID string, numPartitions int32) int32 {
	h := murmur3.Sum32([]byte(workspaceID))
	positive := int32(h & 0x7fffffff) // mask sign bit like Kafka
	return positive % numPartitions
}

// FilterWorkspaceIDsForPartition filters the given workspaceIDs and returns only those
// that would be routed to the specified partition out of numPartitions.
func FilterWorkspaceIDsForPartition(workspaceIDs []string, targetPartition int32, numPartitions int32) []string {
	var result []string
	for _, workspaceID := range workspaceIDs {
		if PartitionForWorkspace(workspaceID, numPartitions) == targetPartition {
			result = append(result, workspaceID)
		}
	}
	return result
}

type WorkspaceIDDiscoverer func(ctx context.Context, targetPartition int32, numPartitions int32) ([]string, error)

func GetAssignedWorkspaceIDs(ctx context.Context, assignedPartitions []int32, numPartitions int32) ([]string, error) {
	workspaceIDs, err := db.GetAllWorkspaceIDs(ctx)
	if err != nil {
		return nil, err
	}

	assignedSet := make(map[int32]bool)
	for _, p := range assignedPartitions {
		assignedSet[p] = true
	}

	var result []string
	for _, workspaceID := range workspaceIDs {
		if assignedSet[PartitionForWorkspace(workspaceID, numPartitions)] {
			result = append(result, workspaceID)
		}
	}

	return workspaceIDs, nil
}
