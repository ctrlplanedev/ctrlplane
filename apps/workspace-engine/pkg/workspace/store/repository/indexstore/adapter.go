package indexstore

import (
	"context"
	"fmt"

	"workspace-engine/pkg/persistence"

	"github.com/hashicorp/go-memdb"
)

// MemDBAdapter adapts a go-memdb table to the persistence.Repository interface.
// This allows the persistence layer (Kafka/Pebble) to update the store.
// go-memdb is inherently thread-safe using MVCC with immutable radix trees.
type MemDBAdapter[E any] struct {
	db        *memdb.MemDB
	tableName string
}

var _ persistence.Repository[any] = &MemDBAdapter[any]{}

// NewMemDBAdapter creates an adapter for a specific table.
// keyFunc extracts the primary key from an entity.
func NewMemDBAdapter[E any](db *memdb.MemDB, tableName string) *MemDBAdapter[E] {
	return &MemDBAdapter[E]{
		db:        db,
		tableName: tableName,
	}
}

// typeAndKey performs type assertion and extracts the entity ID
func (a *MemDBAdapter[E]) typeAndKey(entity any) (typed E, key string, err error) {
	typed, ok := entity.(E)
	if !ok {
		return typed, "", fmt.Errorf("expected %T, got %T", *new(E), entity)
	}

	keyer, ok := any(typed).(persistence.Entity)
	if !ok {
		return typed, "", fmt.Errorf("entity does not implement persistence.Entity interface")
	}
	_, key = keyer.CompactionKey()
	return typed, key, nil
}

// Set inserts or updates an entity in the table.
func (a *MemDBAdapter[E]) Set(ctx context.Context, entity any) error {
	txn := a.db.Txn(true)
	defer txn.Abort()

	if err := txn.Insert(a.tableName, entity); err != nil {
		return fmt.Errorf("failed to insert into %s: %w", a.tableName, err)
	}

	txn.Commit()
	return nil
}

// Unset removes an entity from the table.
func (a *MemDBAdapter[E]) Unset(ctx context.Context, entity any) error {
	_, key, err := a.typeAndKey(entity)
	if err != nil {
		return fmt.Errorf("failed to get key: %w", err)
	}

	txn := a.db.Txn(true)
	defer txn.Abort()

	raw, _ := txn.First(a.tableName, "id", key)
	if raw == nil {
		return nil
	}

	if err := txn.Delete(a.tableName, raw); err != nil {
		return fmt.Errorf("failed to delete from %s: %w", a.tableName, err)
	}

	txn.Commit()
	return nil
}

var _ persistence.Repository[any] = &MemDBAdapter[any]{}
