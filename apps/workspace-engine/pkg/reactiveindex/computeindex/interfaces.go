package computeindex

import "context"

// ComputeFunc evaluates an entity and returns a computed value.
// entityID is an opaque identifier — the implementation resolves it
// to the actual entity and performs the computation.
type ComputeFunc[V any] func(ctx context.Context, entityID string) (V, error)

// Reader provides read-only access to materialized computed values.
type Reader[V any] interface {
	// Get retrieves the computed value for an entity.
	// Returns the value and true if present, or the zero value and false if not.
	Get(entityID string) (V, bool)
	// ForEach iterates over all entities and their computed values.
	// Return false from fn to stop iteration.
	ForEach(fn func(entityID string, value V) bool)
}

// Writer mutates entity registration and dirty state.
type Writer interface {
	// AddEntity registers an entity to be tracked. It is marked dirty so its
	// value is computed on the next Recompute.
	AddEntity(entityID string)
	// RemoveEntity unregisters an entity, clearing its computed value and
	// any pending dirty flag.
	RemoveEntity(entityID string)
	// DirtyEntity marks a registered entity as changed, scheduling it for
	// recomputation on the next Recompute. No-op if the entity is not registered.
	DirtyEntity(entityID string)
	// DirtyAll marks every registered entity as dirty, forcing a full
	// recomputation on the next Recompute.
	DirtyAll()
}

// Recomputer processes dirty state and updates materialized results.
type Recomputer interface {
	// IsDirty reports whether any entities are pending recomputation.
	IsDirty() bool
	// Recompute evaluates all dirty entities and updates their cached values.
	// Returns the number of evaluations performed.
	Recompute(ctx context.Context) int
}

// Stats exposes index cardinality for metrics and tracing.
type Stats interface {
	// EntityCount returns the number of registered entities.
	EntityCount() int
	// DirtyCount returns the number of entities pending recomputation.
	DirtyCount() int
}

// Index is the full interface combining all capabilities.
type Index[V any] interface {
	Reader[V]
	Writer
	Recomputer
	Stats
}
