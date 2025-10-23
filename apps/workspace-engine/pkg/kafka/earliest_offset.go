package kafka

import (
	"math"
	"workspace-engine/pkg/db"

	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

func getEarliestOffset(snapshots map[string]*db.WorkspaceSnapshot) int64 {
	beginning := int64(kafka.OffsetBeginning)
	if len(snapshots) == 0 {
		return beginning
	}

	earliestOffset := int64(math.MaxInt64)
	for _, snapshot := range snapshots {
		if snapshot.Offset < earliestOffset {
			earliestOffset = snapshot.Offset
		}
	}
	if earliestOffset == math.MaxInt64 {
		return beginning
	}
	return earliestOffset
}
