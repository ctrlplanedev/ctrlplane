package kafka

import (
	"context"
	"fmt"
	"workspace-engine/pkg/db"
	"workspace-engine/pkg/messaging"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"
)

var tracer = otel.Tracer("kafka/consumer")


func getEarliestOffset(snapshots map[string]*db.WorkspaceSnapshot) int64 {
	beginning := int64(kafka.OffsetBeginning)
	if len(snapshots) == 0 {
		return beginning
	}

	var earliestOffset int64
	has := false
	for _, snapshot := range snapshots {
		if snapshot == nil {
			continue
		}
		if !has || snapshot.Offset < earliestOffset {
			earliestOffset = snapshot.Offset
			has = true
		}
	}
	if !has {
		return beginning
	}
	return earliestOffset
}

func setOffsets(ctx context.Context, consumer messaging.Consumer, partitionWorkspaceMap map[int32][]string) error {
	ctx, span := tracer.Start(ctx, "setOffsets")
	defer span.End()

	span.SetAttributes(attribute.String("partition_workspace_map", fmt.Sprintf("%+v", partitionWorkspaceMap)))

	for partition, workspaceIDs := range partitionWorkspaceMap {
		snapshots, err := db.GetLatestWorkspaceSnapshots(ctx, workspaceIDs)
		if err != nil {
			log.Error("Failed to get latest workspace snapshots", "error", err)
			return err
		}

		earliestOffset := getEarliestOffset(snapshots)
		effectiveOffset := earliestOffset
		if effectiveOffset > 0 {
			effectiveOffset = effectiveOffset + 1
		}

		span.AddEvent(
			"seeking to earliest offset for partition",
			trace.WithAttributes(
				attribute.Int("partition", int(partition)),
				attribute.Int("effective_offset", int(effectiveOffset)),
			),
		)
		if err := consumer.SeekToOffset(partition, effectiveOffset); err != nil {
			log.Error("Failed to seek to earliest offset", "error", err)
			return err
		}
	}
	return nil
}
