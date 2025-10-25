package changelog

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"workspace-engine/pkg/messaging"
	wskafka "workspace-engine/pkg/workspace/kafka"

	"github.com/charmbracelet/log"
)

// Changeloggable is an interface for objects that can be tracked in the changelog
type Changeloggable interface {
	// ChangeLogID returns a unique identifier for this object in the format:
	// "{workspaceID}/{entityType}/{entityID}"
	// The workspaceID (first UUID) will be used for partitioning
	ChangeLogID() string
}

// ChangelogWriter writes events to a compacted Kafka changelog topic
type ChangelogWriter struct {
	producer      messaging.Producer
	topic         string
	numPartitions int32
}

// NewWriter creates a new changelog writer
func NewWriter(producer messaging.Producer, topic string, numPartitions int32) *ChangelogWriter {
	return &ChangelogWriter{
		producer:      producer,
		topic:         topic,
		numPartitions: numPartitions,
	}
}

// Write writes an object to the changelog topic
// The object must implement Changeloggable to provide a unique key
func (w *ChangelogWriter) Set(ctx context.Context, workspaceID string, obj Changeloggable) error {
	changelogID := obj.ChangeLogID()
	if changelogID == "" {
		return fmt.Errorf("changelogID is empty")
	}

	changelogID = fmt.Sprintf("%s:%s", workspaceID, changelogID)

	// Serialize the object to JSON
	value, err := json.Marshal(obj)
	if err != nil {
		return fmt.Errorf("failed to marshal object: %w", err)
	}

	partition := wskafka.PartitionForWorkspace(workspaceID, w.numPartitions)

	// Publish to Kafka using the full changelogID as the key
	// Kafka will partition based on the key, and we want all events
	// for the same workspace to go to the same partition
	if err := w.producer.PublishToPartition([]byte(changelogID), value, partition); err != nil {
		return fmt.Errorf("failed to publish to changelog: %w", err)
	}

	log.Debug("Wrote to changelog",
		"changelogID", changelogID,
		"workspaceID", workspaceID,
		"size", len(value))

	return nil
}

// Delete tombstones an entry in the changelog by writing a null value
// This is the Kafka compaction way of deleting a key
func (w *ChangelogWriter) Delete(ctx context.Context, workspaceID string, changelogID string) error {
	if changelogID == "" {
		return fmt.Errorf("changelogID is empty")
	}

	changelogID = fmt.Sprintf("%s:%s", workspaceID, changelogID)

	partition := wskafka.PartitionForWorkspace(workspaceID, w.numPartitions)

	// Write a null value to tombstone the key
	if err := w.producer.PublishToPartition([]byte(changelogID), nil, partition); err != nil {
		return fmt.Errorf("failed to tombstone changelog entry: %w", err)
	}

	log.Debug("Tombstoned changelog entry", "changelogID", changelogID)
	return nil
}

// Flush ensures all pending writes are committed
func (w *ChangelogWriter) Flush(timeoutMs int) int {
	return w.producer.Flush(timeoutMs)
}

// Close closes the changelog writer
func (w *ChangelogWriter) Close() error {
	return w.producer.Close()
}

// ExtractWorkspaceID extracts the workspace ID (first UUID) from a changelogID
// Expected format: "{workspaceID}/{entityType}/{entityID}"
// Returns the workspace ID which will be used for partitioning
func ExtractWorkspaceID(changelogID string) (string, error) {
	parts := strings.Split(changelogID, "/")
	if len(parts) == 0 {
		return "", fmt.Errorf("invalid changelogID format: %s", changelogID)
	}

	workspaceID := parts[0]
	if workspaceID == "" {
		return "", fmt.Errorf("workspace ID is empty in changelogID: %s", changelogID)
	}

	return workspaceID, nil
}
