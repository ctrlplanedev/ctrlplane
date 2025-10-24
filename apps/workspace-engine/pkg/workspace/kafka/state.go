package kafka

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("workspace/kafka/state")

// PartitionForWorkspace computes which partition a workspace ID should be routed to
// using Murmur2 hash (matching Kafka's default partitioner and kafkajs)
func PartitionForWorkspace(workspaceID string, numPartitions int32) int32 {
	h := murmur2([]byte(workspaceID))
	positive := int32(h & 0x7fffffff) // mask sign bit like Kafka
	return positive % numPartitions
}

// murmur2 implements the Murmur2 hash algorithm used by Kafka's default partitioner
func murmur2(data []byte) uint32 {
	const (
		seed uint32 = 0x9747b28c
		m    uint32 = 0x5bd1e995
		r           = 24
	)

	h := seed ^ uint32(len(data))
	length := len(data)

	for length >= 4 {
		k := uint32(data[0]) | uint32(data[1])<<8 | uint32(data[2])<<16 | uint32(data[3])<<24

		k *= m
		k ^= k >> r
		k *= m

		h *= m
		h ^= k

		data = data[4:]
		length -= 4
	}

	switch length {
	case 3:
		h ^= uint32(data[2]) << 16
		fallthrough
	case 2:
		h ^= uint32(data[1]) << 8
		fallthrough
	case 1:
		h ^= uint32(data[0])
		h *= m
	}

	h ^= h >> 13
	h *= m
	h ^= h >> 15

	return h
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

func GetAssignedWorkspaceIDs(ctx context.Context, assignedPartitions []int32, numPartitions int32) (map[int32][]string, error) {
	ctx, span := tracer.Start(ctx, "GetAssignedWorkspaceIDs")
	defer span.End()

	span.SetAttributes(attribute.Int("assigned.partitions.count", len(assignedPartitions)))
	span.SetAttributes(attribute.Int("num.partitions", int(numPartitions)))
	span.SetAttributes(attribute.String("assigned.partitions", fmt.Sprintf("%+v", assignedPartitions)))

	workspaceIDs, err := db.GetAllWorkspaceIDs(ctx)
	if err != nil {
		return nil, err
	}

	assignedSet := make(map[int32]bool)
	for _, p := range assignedPartitions {
		assignedSet[p] = true
	}

	result := make(map[int32][]string)
	for _, workspaceID := range workspaceIDs {
		partition := PartitionForWorkspace(workspaceID, numPartitions)
		if assignedSet[partition] {
			span.AddEvent("workspace ID discovered",
				trace.WithAttributes(
					attribute.String("workspaceID", workspaceID),
					attribute.Int("partition", int(partition)),
				),
			)
			result[partition] = append(result[partition], workspaceID)
		}
	}

	return result, nil
}
