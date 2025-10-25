package changelog

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"workspace-engine/pkg/messaging"
	wskafka "workspace-engine/pkg/workspace/kafka"

	"github.com/charmbracelet/log"
)

// ChangelogEntry represents a single entry loaded from the changelog
type ChangelogEntry struct {
	Key         string
	Value       []byte
	Partition   int32
	Offset      int64
	Timestamp   time.Time
	IsTombstone bool
}

// UnmarshalInto unmarshals the value into the provided object
func (e *ChangelogEntry) UnmarshalInto(v interface{}) error {
	if e.IsTombstone {
		return fmt.Errorf("cannot unmarshal tombstone entry")
	}
	return json.Unmarshal(e.Value, v)
}

// ChangelogReader reads entries from a changelog topic
type ChangelogReader struct {
	consumer   messaging.Consumer
	topic      string
	partitions []int32 // specific partitions to read, nil means subscribe to topic
}

// NewReader creates a new changelog reader that subscribes to all partitions via consumer group
func NewReader(consumer messaging.Consumer, topic string) *ChangelogReader {
	return &ChangelogReader{
		consumer:   consumer,
		topic:      topic,
		partitions: nil,
	}
}

// NewReaderForPartitions creates a new changelog reader for specific partitions
// This allows you to manually control which partitions to read from
func NewReaderForPartitions(consumer messaging.Consumer, topic string, partitions []int32) *ChangelogReader {
	return &ChangelogReader{
		consumer:   consumer,
		topic:      topic,
		partitions: partitions,
	}
}

func NewReaderForWorkspace(consumer messaging.Consumer, topic string, workspaceID string, numPartitions int32) *ChangelogReader {
	partition := wskafka.PartitionForWorkspace(workspaceID, numPartitions)
	return &ChangelogReader{
		consumer:   consumer,
		topic:      topic,
		partitions: []int32{partition},
	}
}

// LoadAll loads all entries from the changelog topic
// This is useful for rebuilding state from a compacted topic
// entryHandler is called for each entry, return an error to stop loading
func (r *ChangelogReader) LoadAll(ctx context.Context, entryHandler func(*ChangelogEntry) error) error {
	// If specific partitions are set, use AssignPartitions, otherwise Subscribe
	if r.partitions == nil || len(r.partitions) <= 0 {
		if err := r.consumer.Subscribe(r.topic); err != nil {
			return fmt.Errorf("failed to subscribe to changelog topic: %w", err)
		}
		log.Info("Subscribed to topic", "topic", r.topic)
	} else {
		if err := r.assignPartitions(); err != nil {
			return fmt.Errorf("failed to assign partitions: %w", err)
		}
		log.Info("Assigned specific partitions", "topic", r.topic, "partitions", r.partitions)
	}

	timeout := 5 * time.Second
	consecutiveTimeouts := 0
	maxConsecutiveTimeouts := 3

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		msg, err := r.consumer.ReadMessage(timeout)
		if err != nil {
			if messaging.IsTimeout(err) {
				consecutiveTimeouts++
				if consecutiveTimeouts >= maxConsecutiveTimeouts {
					// No more messages, we've read the entire topic
					log.Info("Finished loading changelog", "topic", r.topic)
					return nil
				}
				continue
			}
			return fmt.Errorf("failed to read message: %w", err)
		}

		// Reset timeout counter
		consecutiveTimeouts = 0

		// If specific partitions are configured, skip messages from other partitions
		if r.partitions != nil && len(r.partitions) > 0 {
			shouldProcess := false
			for _, partition := range r.partitions {
				if msg.Partition == partition {
					shouldProcess = true
					break
				}
			}
			if !shouldProcess {
				// Skip this message, it's not from a partition we care about
				if err := r.consumer.CommitMessage(msg); err != nil {
					log.Warn("Failed to commit skipped message offset", "offset", msg.Offset, "error", err)
				}
				continue
			}
		}

		entry := &ChangelogEntry{
			Key:         string(msg.Key),
			Value:       msg.Value,
			Partition:   msg.Partition,
			Offset:      msg.Offset,
			Timestamp:   msg.Timestamp,
			IsTombstone: msg.Value == nil,
		}

		if err := entryHandler(entry); err != nil {
			return fmt.Errorf("entry handler error at offset %d: %w", msg.Offset, err)
		}

		// Commit the offset
		if err := r.consumer.CommitMessage(msg); err != nil {
			log.Warn("Failed to commit offset", "offset", msg.Offset, "error", err)
		}
	}
}

// LoadAllIntoMap loads all entries into a map keyed by changelogID
// Tombstoned entries are removed from the map
// This is useful for building an in-memory snapshot of the changelog
func (r *ChangelogReader) LoadAllIntoMap(ctx context.Context) (map[string]*ChangelogEntry, error) {
	entries := make(map[string]*ChangelogEntry)

	err := r.LoadAll(ctx, func(entry *ChangelogEntry) error {
		if entry.IsTombstone {
			// Remove tombstoned entries
			delete(entries, entry.Key)
			log.Debug("Removed tombstoned entry", "key", entry.Key)
		} else {
			// Add or update entry
			entries[entry.Key] = entry
			log.Debug("Loaded entry", "key", entry.Key, "size", len(entry.Value))
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	log.Info("Loaded changelog into map", "topic", r.topic, "entries", len(entries))
	return entries, nil
}

// LoadForWorkspace loads all entries for a specific workspace
// workspaceID is the workspace ID to filter by
func (r *ChangelogReader) LoadForWorkspace(ctx context.Context, workspaceID string) (map[string]*ChangelogEntry, error) {
	entries := make(map[string]*ChangelogEntry)

	err := r.LoadAll(ctx, func(entry *ChangelogEntry) error {
		// Extract workspace ID from the key
		entryWorkspaceID, err := ExtractWorkspaceID(entry.Key)
		if err != nil {
			log.Warn("Invalid changelog entry key", "key", entry.Key, "error", err)
			return nil // Skip invalid entries
		}

		// Only process entries for this workspace
		if entryWorkspaceID != workspaceID {
			return nil
		}

		if entry.IsTombstone {
			delete(entries, entry.Key)
			log.Debug("Removed tombstoned entry for workspace", "workspaceID", workspaceID, "key", entry.Key)
		} else {
			entries[entry.Key] = entry
			log.Debug("Loaded entry for workspace", "workspaceID", workspaceID, "key", entry.Key)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	log.Info("Loaded changelog for workspace", "workspaceID", workspaceID, "entries", len(entries))
	return entries, nil
}

// assignPartitions manually assigns specific partitions to this consumer
// This is used when reading from specific partitions instead of using consumer groups
func (r *ChangelogReader) assignPartitions() error {
	// For manual partition assignment, we need to use Kafka's Assign API
	// The messaging.Consumer interface doesn't have this yet, so we'll use Subscribe
	// and filter messages by partition

	// Subscribe to the topic first
	if err := r.consumer.Subscribe(r.topic); err != nil {
		return fmt.Errorf("failed to subscribe to topic: %w", err)
	}

	// Note: The actual partition filtering will happen in LoadAll
	// A better approach would be to extend the messaging.Consumer interface
	// to support AssignPartitions() method in the future

	return nil
}

// GetPartitions returns the partitions this reader is configured to read from
// Returns nil if reading from all partitions via consumer group
func (r *ChangelogReader) GetPartitions() []int32 {
	return r.partitions
}

// Close closes the changelog reader
func (r *ChangelogReader) Close() error {
	return r.consumer.Close()
}
