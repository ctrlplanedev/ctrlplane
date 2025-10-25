package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"workspace-engine/pkg/db"
	"workspace-engine/pkg/events"
	eventHanlder "workspace-engine/pkg/events/handler"
	"workspace-engine/pkg/events/handler/workspacesave"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/messaging/confluent"
	"workspace-engine/pkg/workspace"
	wskafka "workspace-engine/pkg/workspace/kafka"

	"github.com/charmbracelet/log"
	"github.com/confluentinc/confluent-kafka-go/v2/kafka"
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

func getLastSnapshot(ctx context.Context, msg *messaging.Message) (*db.WorkspaceSnapshot, error) {
	var rawEvent eventHanlder.RawEvent
	if err := json.Unmarshal(msg.Value, &rawEvent); err != nil {
		log.Error("Failed to unmarshal event", "error", err, "message", string(msg.Value))
		return nil, fmt.Errorf("failed to unmarshal event: %w", err)
	}

	return db.GetWorkspaceSnapshot(ctx, rawEvent.WorkspaceID)
}

func getLastWorkspaceOffset(snapshot *db.WorkspaceSnapshot) int64 {
	beginning := int64(kafka.OffsetBeginning)

	if snapshot == nil {
		return beginning
	}

	return snapshot.Offset
}

func NewConsumer(brokers string) (messaging.Consumer, error) {
	return confluent.NewConfluent(brokers).CreateConsumer(GroupID, &kafka.ConfigMap{
		"bootstrap.servers":               Brokers,
		"group.id":                        GroupID,
		"auto.offset.reset":               "earliest",
		"enable.auto.commit":              false,
		"partition.assignment.strategy":   "cooperative-sticky",
	})
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
	log.Info("Subscribing to Kafka topic", "topic", Topic, "group", GroupID)
	if err := consumer.Subscribe(Topic); err != nil {
		log.Error("Failed to subscribe", "error", err)
		return err
	}

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
		ws, err := workspace.GetWorkspaceAndLoad(workspaceID)
		if ws == nil {
			log.Error("Workspace not found", "workspaceID", workspaceID, "error", err)
			continue
		}
	}

	if err := setOffsets(ctx, consumer, partitionWorkspaceMap); err != nil {
		return fmt.Errorf("failed to set offsets: %w", err)
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

		lastSnapshot, err := getLastSnapshot(ctx, msg)
		if err != nil {
			log.Error("Failed to get last snapshot", "error", err)
			continue
		}

		messageOffset := msg.Offset
		lastCommittedOffset, err := consumer.GetCommittedOffset(msg.Partition)
		if err != nil {
			log.Error("Failed to get committed offset", "error", err)
			continue
		}
		lastWorkspaceOffset := getLastWorkspaceOffset(lastSnapshot)

		offsetTracker := eventHanlder.OffsetTracker{
			LastCommittedOffset: lastCommittedOffset,
			LastWorkspaceOffset: lastWorkspaceOffset,
			MessageOffset:       messageOffset,
		}

		ws, err := handler.ListenAndRoute(ctx, msg, offsetTracker)
		if err != nil {
			log.Error("Failed to route message", "error", err)
		}

		// Commit offset to Kafka
		if err := consumer.CommitMessage(msg); err != nil {
			log.Error("Failed to commit message", "error", err)
			continue
		}

		if ws == nil {
			log.Error("Workspace not found", "workspaceID", msg.Key)
			continue
		}

		if workspacesave.IsWorkspaceSaveEvent(msg) {
			snapshot := &db.WorkspaceSnapshot{
				WorkspaceID:   ws.ID,
				Path:          fmt.Sprintf("%s.gob", ws.ID),
				Timestamp:     msg.Timestamp,
				Partition:     msg.Partition,
				Offset:        msg.Offset,
				NumPartitions: numPartitions,
			}

			if err := workspace.Save(ctx, ws, snapshot); err != nil {
				log.Error("Failed to save workspace", "workspaceID", ws.ID, "snapshotPath", snapshot.Path, "error", err)
			}
		}
	}
}
