package kafka

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/config"
	"workspace-engine/pkg/events"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
	wskafka "workspace-engine/pkg/workspace/kafka"
	"workspace-engine/pkg/workspace/manager"

	"github.com/charmbracelet/log"
)

// Configuration variables loaded from environment
var (
	Topic   = config.Global.KafkaTopic
	GroupID = config.Global.KafkaGroupID
	Brokers = config.Global.KafkaBrokers
)

func NewConsumer(brokers string, topic string) (messaging.Consumer, error) {
	cfg := confluent.BaseConsumerConfig()
	_ = cfg.SetKey("auto.offset.reset", "latest")
	_ = cfg.SetKey("max.poll.interval.ms", 900_000)
	return confluent.NewConfluent(brokers).CreateConsumer(GroupID, topic, cfg)
}

// RunConsumerWithWorkspaceLoader starts the Kafka consumer with workspace-based offset resume
//
// Flow:
//  1. Connect to Kafka and subscribe to topic
//  2. Wait for partition assignment
//  3. Load workspaces for assigned partitions (if workspaceLoader provided)
//  4. Seek to stored offsets per partition
//  5. Start consuming and processing messages
func RunConsumer(ctx context.Context, consumer messaging.Consumer) error {
	// Subscribe to topic
	log.Info("Subscribing to Kafka topic", "topic", Topic, "group", GroupID, "brokers", Brokers)
	log.Info("Waiting for Kafka partition assignment - this may take 30-120 seconds on first startup")

	log.Info("Successfully subscribed to topic", "topic", Topic)

	assignedPartitions, err := consumer.GetAssignedPartitions()
	if err != nil {
		return fmt.Errorf("failed to get assigned partitions: %w", err)
	}

	// Get total partition count
	numPartitions, err := consumer.GetPartitionCount()
	if err != nil {
		return fmt.Errorf("failed to get topic partition count: %w", err)
	}

	log.Info("Partition assignment complete", "assigned", assignedPartitions)

	partitionWorkspaceMap, err := wskafka.GetAssignedWorkspaceIDs(ctx, assignedPartitions, numPartitions)
	if err != nil {
		return fmt.Errorf("failed to get assigned workspace IDs: %w", err)
	}

	// Flatten the map to get all workspace IDs
	var allWorkspaceIDs []string
	for _, workspaceIDs := range partitionWorkspaceMap {
		allWorkspaceIDs = append(allWorkspaceIDs, workspaceIDs...)
	}

	log.Info("All workspace IDs", "workspaceIDs", allWorkspaceIDs)
	for _, workspaceID := range allWorkspaceIDs {
		ws, err := manager.GetOrLoad(ctx, workspaceID)
		if err != nil {
			log.Error("Failed to get or load workspace", "workspaceID", workspaceID, "error", err)
			continue
		}
		if ws == nil {
			log.Error("Workspace not found", "workspaceID", workspaceID, "error", err)
			continue
		}
	}

	// Start consuming messages
	handler := events.NewEventHandler()

	for {
		// Check for cancellation
		select {
		case <-ctx.Done():
			log.Info("Context cancelled, stopping consumer")
			return nil
		default:
		}

		// Read message from Kafka
		msg, err := consumer.ReadMessage(time.Second)
		start := time.Now()
		if err != nil {
			if messaging.IsTimeout(err) {
				continue
			}
			log.Error("failed to read message", "error", err)
			time.Sleep(time.Second)
			continue
		}

		if msg == nil {
			log.Error("No message read, continuing")
			log.Error("This should not happen, topic is subscribed and we are waiting for a message")
		}

		ws, err := handler.ListenAndRoute(ctx, msg)
		if err != nil {
			log.Error("Failed to route message", "error", err)
		}

		// Commit offset to Kafka
		if err := consumer.CommitMessage(msg); err != nil {
			log.Error("Failed to commit message", "error", err)
			continue
		}

		duration := time.Since(start)
		// Print performance duration after processing
		log.Info("Message processed", "duration_ms", duration.Milliseconds())

		if ws == nil {
			log.Error("Workspace not found", "workspaceID", msg.Key)
			continue
		}
	}
}
