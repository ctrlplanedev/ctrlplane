package kafka

import (
	"context"
	"math"
	"workspace-engine/pkg/db"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// createConsumer initializes a new Kafka consumer with the configured settings
func createConsumer() (*kafka.Consumer, error) {
	log.Info("Connecting to Kafka", "brokers", Brokers)

	c, err := kafka.NewConsumer(&kafka.ConfigMap{
		"bootstrap.servers":               Brokers,
		"group.id":                        GroupID,
		"auto.offset.reset":               "earliest",
		"enable.auto.commit":              false,
		"partition.assignment.strategy":   "cooperative-sticky",
		"session.timeout.ms":              10000,
		"heartbeat.interval.ms":           3000,
		"go.application.rebalance.enable": true, // Enable rebalance callbacks
	})

	if err != nil {
		log.Error("Failed to create consumer", "error", err)
		return nil, err
	}

	return c, nil
}

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

func setOffsets(ctx context.Context, consumer *kafka.Consumer, partitionWorkspaceMap map[int32][]string) {
	for partition, workspaceIDs := range partitionWorkspaceMap {
		snapshots, err := db.GetLatestWorkspaceSnapshots(ctx, workspaceIDs)
		if err != nil {
			log.Error("Failed to get latest workspace snapshots", "error", err)
			continue
		}

		earliestOffset := getEarliestOffset(snapshots)
		effectiveOffset := earliestOffset
		if effectiveOffset > 0 {
			effectiveOffset = effectiveOffset + 1
		}
		if err := consumer.Seek(kafka.TopicPartition{
			Topic:     &Topic,
			Partition: partition,
			Offset:    kafka.Offset(effectiveOffset),
		}, 0); err != nil {
			log.Error("Failed to seek to earliest offset", "error", err)
			continue
		}
	}
}
