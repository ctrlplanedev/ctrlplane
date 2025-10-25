package kafka

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"workspace-engine/pkg/kafka/changelog"
	"workspace-engine/pkg/messaging"
	"workspace-engine/pkg/workspace/persistence"
)

// Store implements changelog store using Kafka compacted topics
type Store struct {
	writer     *changelog.ChangelogWriter
	consumer   messaging.Consumer
	topic      string
	partitions int32
}

func NewStore(
	producer messaging.Producer,
	consumer messaging.Consumer,
	topic string,
	partitions int32,
) *Store {
	return &Store{
		writer:     changelog.NewWriter(producer, topic, partitions),
		consumer:   consumer,
		topic:      topic,
		partitions: partitions,
	}
}

func (s *Store) Append(ctx context.Context, changes persistence.Changelog) error {
	if len(changes) == 0 {
		return nil
	}

	workspaceID := changes[0].WorkspaceID

	for i := range changes {
		if changes[i].Timestamp.IsZero() {
			changes[i].Timestamp = time.Now()
		}

		entityType, entityID := changes[i].Entity.ChangelogKey()
		changelogID := fmt.Sprintf("%s:%s", entityType, entityID)

		// For deletes, write a tombstone
		if changes[i].ChangeType == persistence.ChangeTypeDelete {
			if err := s.writer.Delete(ctx, workspaceID, changelogID); err != nil {
				return fmt.Errorf("failed to write delete: %w", err)
			}
			continue
		}

		// Wrap entity with metadata for proper deserialization
		wrapper := &changeWrapper{
			EntityType: string(entityType),
			EntityID:   entityID,
			ChangeType: string(changes[i].ChangeType),
			Timestamp:  changes[i].Timestamp.Unix(),
			Entity:     changes[i].Entity,
		}

		if err := s.writer.Set(ctx, workspaceID, wrapper); err != nil {
			return fmt.Errorf("failed to write change: %w", err)
		}
	}

	return nil
}

func (s *Store) LoadAll(ctx context.Context, workspaceID string) (persistence.Changelog, error) {
	reader := changelog.NewReaderForWorkspace(s.consumer, s.topic, workspaceID, s.partitions)
	defer reader.Close()

	entries, err := reader.LoadForWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, fmt.Errorf("failed to load from Kafka: %w", err)
	}

	var changes persistence.Changelog

	for _, entry := range entries {
		var wrapper changeWrapper
		if err := json.Unmarshal(entry.Value, &wrapper); err != nil {
			return nil, fmt.Errorf("failed to unmarshal entry: %w", err)
		}

		// Note: Entity deserialization would need a factory pattern
		// For now, this is a placeholder showing the structure
		change := persistence.Change{
			WorkspaceID: workspaceID,
			ChangeType:  persistence.ChangeType(wrapper.ChangeType),
			// Entity would need proper deserialization based on EntityType
			Timestamp: time.Unix(wrapper.Timestamp, 0),
		}

		changes = append(changes, change)
	}

	return changes, nil
}

func (s *Store) Close() error {
	if err := s.writer.Close(); err != nil {
		return err
	}
	return s.consumer.Close()
}

// changeWrapper wraps entity data with metadata for Kafka storage
type changeWrapper struct {
	EntityType string      `json:"entity_type"`
	EntityID   string      `json:"entity_id"`
	ChangeType string      `json:"change_type"`
	Timestamp  int64       `json:"timestamp"`
	Entity     interface{} `json:"entity"`
}

func (w *changeWrapper) ChangeLogID() string {
	return fmt.Sprintf("%s:%s", w.EntityType, w.EntityID)
}
