package indexstore

import (
	"fmt"

	"github.com/hashicorp/go-memdb"
)

// Store is a generic wrapper around memdb for a specific table.
// It provides type-safe read operations for querying entities.
type Store[E any] struct {
	db        *memdb.MemDB
	tableName string
	getKey    func(E) string
}

// NewStore creates a new Store for a specific table.
func NewStore[E any](db *memdb.MemDB, tableName string, getKey func(E) string) *Store[E] {
	return &Store[E]{
		db:        db,
		tableName: tableName,
		getKey:    getKey,
	}
}

// Get retrieves an entity by its primary key (id index).
func (s *Store[E]) Get(id string) (E, bool) {
	var zero E
	txn := s.db.Txn(false)
	defer txn.Abort()

	raw, err := txn.First(s.tableName, "id", id)
	if err != nil {
		return zero, false
	}
	if raw == nil {
		return zero, false
	}

	entity, ok := raw.(E)
	if !ok {
		return zero, false
	}
	return entity, true
}

// Set inserts or updates an entity in the table.
func (s *Store[E]) Set(entity E) error {
	txn := s.db.Txn(true)
	defer txn.Abort()

	if err := txn.Insert(s.tableName, entity); err != nil {
		return fmt.Errorf("failed to set in %s: %w", s.tableName, err)
	}

	txn.Commit()
	return nil
}

// Remove deletes an entity from the table by its ID.
func (s *Store[E]) Remove(id string) error {
	txn := s.db.Txn(true)
	defer txn.Abort()

	raw, err := txn.First(s.tableName, "id", id)
	if err != nil {
		return fmt.Errorf("failed to find entity in %s: %w", s.tableName, err)
	}
	if raw == nil {
		return nil // Already doesn't exist
	}

	if err := txn.Delete(s.tableName, raw); err != nil {
		return fmt.Errorf("failed to remove from %s: %w", s.tableName, err)
	}

	txn.Commit()
	return nil
}

// First retrieves the first entity matching the given index and value.
func (s *Store[E]) First(index string, args ...any) (E, error) {
	var zero E
	txn := s.db.Txn(false)
	defer txn.Abort()

	raw, err := txn.First(s.tableName, index, args...)
	if err != nil {
		return zero, fmt.Errorf("failed to query %s by %s: %w", s.tableName, index, err)
	}
	if raw == nil {
		return zero, nil
	}

	entity, ok := raw.(E)
	if !ok {
		return zero, fmt.Errorf("expected %T, got %T", zero, raw)
	}
	return entity, nil
}

// GetAll retrieves all entities from the table.
func (s *Store[E]) Items() map[string]E {
	txn := s.db.Txn(false)
	defer txn.Abort()

	iter, err := txn.Get(s.tableName, "id")
	if err != nil {
		return nil
	}

	entities := make(map[string]E)
	for raw := iter.Next(); raw != nil; raw = iter.Next() {
		entity, ok := raw.(E)
		if !ok {
			continue
		}
		id := s.getKey(entity)
		entities[id] = entity
	}
	return entities
}

// GetBy retrieves all entities matching the given index and value.
func (s *Store[E]) GetBy(index string, args ...any) ([]E, error) {
	txn := s.db.Txn(false)
	defer txn.Abort()

	iter, err := txn.Get(s.tableName, index, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query %s by %s: %w", s.tableName, index, err)
	}

	var entities []E
	for raw := iter.Next(); raw != nil; raw = iter.Next() {
		entity, ok := raw.(E)
		if !ok {
			return nil, fmt.Errorf("expected %T, got %T", *new(E), raw)
		}
		entities = append(entities, entity)
	}
	return entities, nil
}

// ForEach iterates over all entities and calls fn for each one.
// If fn returns false, iteration stops.
func (s *Store[E]) ForEach(fn func(E) bool) error {
	txn := s.db.Txn(false)
	defer txn.Abort()

	iter, err := txn.Get(s.tableName, "id")
	if err != nil {
		return fmt.Errorf("failed to iterate %s: %w", s.tableName, err)
	}

	for raw := iter.Next(); raw != nil; raw = iter.Next() {
		entity, ok := raw.(E)
		if !ok {
			return fmt.Errorf("expected %T, got %T", *new(E), raw)
		}
		if !fn(entity) {
			break
		}
	}
	return nil
}

// Count returns the number of entities in the table.
func (s *Store[E]) Count() (int, error) {
	txn := s.db.Txn(false)
	defer txn.Abort()

	iter, err := txn.Get(s.tableName, "id")
	if err != nil {
		return 0, fmt.Errorf("failed to count %s: %w", s.tableName, err)
	}

	count := 0
	for raw := iter.Next(); raw != nil; raw = iter.Next() {
		count++
	}
	return count, nil
}

// Txn returns a read-only transaction for advanced queries.
// The caller is responsible for calling Abort() when done.
func (s *Store[E]) Txn() *memdb.Txn {
	return s.db.Txn(false)
}

// TableName returns the name of the table this store wraps.
func (s *Store[E]) TableName() string {
	return s.tableName
}
