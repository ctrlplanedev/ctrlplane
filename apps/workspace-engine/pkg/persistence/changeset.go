package persistence

import (
	"context"
	"log/slog"
	"time"

	"workspace-engine/pkg/statechange"
)

// PersistingChangeSet wraps a BatchBufferedChangeSet to automatically persist
// state changes to a Store. It converts statechange types to persistence types
// and batches writes for efficiency.
//
// It implements ChangeRecorder and is a pure async processor that persists
// changes to an external store.
type PersistingChangeSet struct {
	*statechange.BatchBufferedChangeSet[any]
	namespace string
	store     Store
	log       *slog.Logger
}

// PersistingChangeSetOption configures a PersistingChangeSet.
type PersistingChangeSetOption func(*PersistingChangeSet)

// WithLogger sets a custom logger.
func WithLogger(log *slog.Logger) PersistingChangeSetOption {
	return func(p *PersistingChangeSet) {
		p.log = log
	}
}

// NewPersistingChangeSet creates a ChangeRecorder that automatically persists changes
// to the given Store. Changes are batched and deduplicated before being written.
//
// The namespace is used as the partition key for all changes.
func NewPersistingChangeSet(
	namespace string,
	store Store,
	opts ...PersistingChangeSetOption,
) *PersistingChangeSet {
	p := &PersistingChangeSet{
		namespace: namespace,
		store:     store,
		log:       slog.Default(),
	}

	for _, opt := range opts {
		opt(p)
	}

	// Create the batch buffered changeset with persistence as the process function
	p.BatchBufferedChangeSet = statechange.NewBatchBufferedChangeSet(
		p.persistBatch,
		statechange.WithKeyFunc(entityKey),
		statechange.WithBatchSize[any](100),
		statechange.WithFlushInterval[any](time.Second),
		statechange.WithBatchOnError[any](func(err error) {
			p.log.Error("Failed to persist changes", "error", err)
		}),
	)

	return p
}

// entityKey extracts a deduplication key from an entity.
// Only persistence.Entity types have keys; other types get unique keys.
func entityKey(entity any) string {
	if e, ok := entity.(Entity); ok {
		entityType, entityID := e.CompactionKey()
		return entityType + ":" + entityID
	}
	// Non-Entity types won't be deduplicated
	return ""
}

// persistBatch converts and persists a batch of state changes.
func (p *PersistingChangeSet) persistBatch(stateChanges []statechange.StateChange[any]) error {
	changes := make(Changes, 0, len(stateChanges))

	for _, sc := range stateChanges {
		entity, ok := sc.Entity.(Entity)
		if !ok {
			// Skip non-Entity types
			continue
		}

		var changeType ChangeType
		switch sc.Type {
		case statechange.StateChangeUpsert:
			changeType = ChangeTypeSet
		case statechange.StateChangeDelete:
			changeType = ChangeTypeUnset
		default:
			p.log.Warn("Unknown state change type", "type", sc.Type)
			continue
		}

		changes = append(changes, Change{
			Namespace:  p.namespace,
			ChangeType: changeType,
			Entity:     entity,
			Timestamp:  sc.Timestamp,
		})
	}

	if len(changes) == 0 {
		return nil
	}

	ctx := context.Background()
	return p.store.Save(ctx, changes)
}

// Namespace returns the namespace used for persistence.
func (p *PersistingChangeSet) Namespace() string {
	return p.namespace
}

var _ statechange.ChangeRecorder[any] = (*PersistingChangeSet)(nil)