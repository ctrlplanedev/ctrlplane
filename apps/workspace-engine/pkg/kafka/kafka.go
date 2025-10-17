package kafka

import (
	"context"
	"os"
	"time"

	"workspace-engine/pkg/events"
	"workspace-engine/pkg/workspace"

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

// RunConsumer starts the Kafka consumer without offset resume
// Uses default Kafka offsets (committed offsets or 'earliest')
func RunConsumer(ctx context.Context) error {
	return RunConsumerWithWorkspaceLoader(ctx, nil)
}

// RunConsumerWithWorkspaceLoader starts the Kafka consumer with workspace-based offset resume
//
// Flow:
//  1. Connect to Kafka and subscribe to topic
//  2. Wait for partition assignment
//  3. Load workspaces for assigned partitions (if workspaceLoader provided)
//  4. Seek to stored offsets per partition
//  5. Start consuming and processing messages
func RunConsumerWithWorkspaceLoader(ctx context.Context, workspaceLoader workspace.WorkspaceLoader) error {
	// Initialize Kafka consumer
	consumer, err := createConsumer()
	if err != nil {
		return err
	}
	defer consumer.Close()

	// Subscribe to topic
	if err := consumer.SubscribeTopics([]string{Topic}, nil); err != nil {
		log.Error("Failed to subscribe", "error", err)
		return err
	}

	// Load workspaces and seek to stored offsets if workspace loader is provided
	if workspaceLoader != nil {
		if err := loadWorkspacesAndApplyOffsets(ctx, consumer, workspaceLoader); err != nil {
			log.Warn("Failed to load workspaces and apply stored offsets, starting from default position", "error", err)
		}
	}

	log.Info("Started Kafka consumer for ctrlplane-events")

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

		// Process message and update workspace state
		if err := processMessage(ctx, consumer, handler, msg); err != nil {
			log.Error("Failed to process message", "error", err)
			continue
		}
	}
}
