package kafka

import (
	"context"
	"fmt"
	"os"
	"time"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/events"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace"
	wskafka "workspace-engine/pkg/workspace/kafka"

	"github.com/aws/smithy-go/ptr"
	"github.com/charmbracelet/log"
)

// Configuration variables loaded from environment
var (
	Topic   = getEnv("KAFKA_TOPIC", "workspace-events")
	GroupID = getEnv("KAFKA_GROUP_ID", "workspace-engine")
	Brokers = getEnv("KAFKA_BROKERS", "localhost:9092")
)

// getEnv retrieves an environment variable or returns a default value
func getEnv(varName string, defaultValue string) string {
	v := os.Getenv(varName)
	if v == "" {
		return defaultValue
	}
	return v
}

// RunConsumerWithWorkspaceLoader starts the Kafka consumer with workspace-based offset resume
//
// Flow:
//  1. Connect to Kafka and subscribe to topic
//  2. Wait for partition assignment
//  3. Load workspaces for assigned partitions (if workspaceLoader provided)
//  4. Seek to stored offsets per partition
//  5. Start consuming and processing messages
func RunConsumer(ctx context.Context) error {
	// Initialize Kafka consumer
	consumer, err := createConsumer()
	if err != nil {
		return err
	}
	defer consumer.Close()

	// Check broker connectivity and topic existence
	log.Info("Checking Kafka broker connectivity...")
	metadata, err := consumer.GetMetadata(&Topic, false, 10000)
	if err != nil {
		log.Error("Failed to get Kafka metadata - broker may not be reachable", "error", err)
		return fmt.Errorf("kafka metadata error: %w", err)
	}

	topicInfo, topicExists := metadata.Topics[Topic]
	if !topicExists {
		log.Error("Topic does not exist", "topic", Topic)
		return fmt.Errorf("kafka topic '%s' does not exist - please create it before starting the consumer", Topic)
	}
	log.Info("Topic exists", "topic", Topic, "partitions", len(topicInfo.Partitions))

	// Subscribe to topic
	log.Info("Subscribing to Kafka topic", "topic", Topic, "group", GroupID)
	if err := consumer.SubscribeTopics([]string{Topic}, nil); err != nil {
		log.Error("Failed to subscribe", "error", err)
		return err
	}
	log.Info("Successfully subscribed to topic", "topic", Topic)

	assignedPartitions, err := waitForPartitionAssignment(ctx, consumer)
	if err != nil {
		return fmt.Errorf("failed to wait for partition assignment: %w", err)
	}

	// Get total partition count
	numPartitions, err := getTopicPartitionCount(consumer)
	if err != nil {
		return fmt.Errorf("failed to get topic partition count: %w", err)
	}
	log.Info("Partition assignment complete", "assigned", assignedPartitions)

	allWorkspaceIDs, err := wskafka.GetAssignedWorkspaceIDs(ctx, assignedPartitions, numPartitions)
	if err != nil {
		return fmt.Errorf("failed to get assigned workspace IDs: %w", err)
	}

	storage := workspace.NewFileStorage("./state")
	if workspace.IsGCSStorageEnabled() {
		storage, err = workspace.NewGCSStorageClient(ctx)
		if err != nil {
			return fmt.Errorf("failed to create GCS storage: %w", err)
		}
	}

	log.Info("All workspace IDs", "workspaceIDs", allWorkspaceIDs)
	for _, workspaceID := range allWorkspaceIDs {
		ws := workspace.GetWorkspace(workspaceID)
		if ws == nil {
			log.Error("Workspace not found", "workspaceID", workspaceID)
			continue
		}
		if err := workspace.Load(ctx, storage, ws); err != nil {
			log.Error("Failed to load workspace", "workspaceID", workspaceID, "error", err)
			continue
		}

		ws.Systems().Upsert(ctx, &oapi.System{
			Id:          "00000000-0000-0000-0000-000000000000",
			Name:        "Default",
			Description: ptr.String("Default system"),
		})
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
		if err != nil {
			handleReadError(err)
			continue
		}

		ws, err := handler.ListenAndRoute(ctx, msg)
		if err != nil {
			log.Error("Failed to route message", "error", err)
			continue
		}

		// Commit offset to Kafka
		if _, err := consumer.CommitMessage(msg); err != nil {
			log.Error("Failed to commit message", "error", err)
			continue
		}

		snapshot := &db.WorkspaceSnapshot{
			Path:          fmt.Sprintf("%s.gob", ws.ID),
			Timestamp:     msg.Timestamp,
			Partition:     int32(msg.TopicPartition.Partition),
			NumPartitions: numPartitions,
		}

		workspace.Save(ctx, storage, ws, snapshot)
	}
}
