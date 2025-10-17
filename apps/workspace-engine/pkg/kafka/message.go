package kafka

import (
	"context"
	"fmt"
	"time"

	"workspace-engine/pkg/workspace"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
)

// messageHandler interface for routing and processing messages
type messageHandler interface {
	ListenAndRoute(ctx context.Context, msg *kafka.Message) (*workspace.Workspace, error)
}

// handleReadError handles errors from reading Kafka messages
func handleReadError(err error) {
	if kafkaErr, ok := err.(kafka.Error); ok && kafkaErr.IsTimeout() {
		log.Debug("Timeout, continuing")
		time.Sleep(time.Second)
		return
	}
	log.Error("Consumer error", "error", err)
	time.Sleep(time.Second)
}

// processMessage handles a single Kafka message: route to workspace, track offset, commit
func processMessage(ctx context.Context, consumer *kafka.Consumer, handler messageHandler, msg *kafka.Message) error {
	// Route message to appropriate workspace
	ws, err := handler.ListenAndRoute(ctx, msg)
	if err != nil {
		return fmt.Errorf("failed to route message: %w", err)
	}

	// Track offset in workspace state BEFORE committing
	// This ensures the workspace state reflects the correct resume point
	ws.KafkaProgress.FromMessage(msg)

	// Commit offset to Kafka
	if _, err := consumer.CommitMessage(msg); err != nil {
		return fmt.Errorf("failed to commit message: %w", err)
	}

	return nil
}
