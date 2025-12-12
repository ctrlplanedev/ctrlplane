package persistence

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// testEntity implements the Entity interface for testing
type testEntity struct {
	Type string
	ID   string
	Name string
}

func (e testEntity) CompactionKey() (string, string) {
	return e.Type, e.ID
}

// mockStore is a test implementation of Store
type mockStore struct {
	mu      sync.Mutex
	saved   []Changes
	loadErr error
	saveErr error
}

func (m *mockStore) Save(ctx context.Context, changes Changes) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.saveErr != nil {
		return m.saveErr
	}
	m.saved = append(m.saved, changes)
	return nil
}

func (m *mockStore) Load(ctx context.Context, namespace string) (Changes, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.loadErr != nil {
		return nil, m.loadErr
	}
	return nil, nil
}

func (m *mockStore) Close() error {
	return nil
}

func (m *mockStore) SavedChanges() []Changes {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.saved
}

func (m *mockStore) TotalChangeCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	count := 0
	for _, batch := range m.saved {
		count += len(batch)
	}
	return count
}

func TestPersistingChangeSet_Basic(t *testing.T) {
	store := &mockStore{}

	pcs := NewPersistingChangeSet("test-namespace", store)

	// Record some changes
	pcs.RecordUpsert(testEntity{Type: "user", ID: "1", Name: "Alice"})
	pcs.RecordUpsert(testEntity{Type: "user", ID: "2", Name: "Bob"})
	pcs.RecordDelete(testEntity{Type: "user", ID: "3", Name: "Charlie"})

	// Wait for flush
	time.Sleep(1500 * time.Millisecond)
	pcs.Close()

	// Verify changes were persisted
	assert.GreaterOrEqual(t, store.TotalChangeCount(), 3)

	// Verify namespace
	for _, batch := range store.SavedChanges() {
		for _, change := range batch {
			assert.Equal(t, "test-namespace", change.Namespace)
		}
	}
}

func TestPersistingChangeSet_Deduplication(t *testing.T) {
	store := &mockStore{}

	pcs := NewPersistingChangeSet("test-namespace", store)

	// Record multiple updates to the same entity
	pcs.RecordUpsert(testEntity{Type: "user", ID: "1", Name: "First"})
	pcs.RecordUpsert(testEntity{Type: "user", ID: "1", Name: "Second"})
	pcs.RecordUpsert(testEntity{Type: "user", ID: "1", Name: "Final"})

	// Wait for flush
	time.Sleep(1500 * time.Millisecond)
	pcs.Close()

	// Should have deduplicated to 1 change
	assert.Equal(t, 1, store.TotalChangeCount())

	// Verify it's the final value
	batch := store.SavedChanges()[0]
	assert.Equal(t, "Final", batch[0].Entity.(testEntity).Name)
}

func TestPersistingChangeSet_ChangeTypeMapping(t *testing.T) {
	store := &mockStore{}

	pcs := NewPersistingChangeSet("test-namespace", store)

	pcs.RecordUpsert(testEntity{Type: "user", ID: "1", Name: "Alice"})
	pcs.RecordDelete(testEntity{Type: "user", ID: "2", Name: "Bob"})

	time.Sleep(1500 * time.Millisecond)
	pcs.Close()

	// Find changes by entity ID
	var upsertChange, deleteChange *Change
	for _, batch := range store.SavedChanges() {
		for i := range batch {
			entity := batch[i].Entity.(testEntity)
			if entity.ID == "1" {
				upsertChange = &batch[i]
			} else if entity.ID == "2" {
				deleteChange = &batch[i]
			}
		}
	}

	assert.NotNil(t, upsertChange)
	assert.NotNil(t, deleteChange)
	assert.Equal(t, ChangeTypeSet, upsertChange.ChangeType)
	assert.Equal(t, ChangeTypeUnset, deleteChange.ChangeType)
}

func TestPersistingChangeSet_NonEntitySkipped(t *testing.T) {
	store := &mockStore{}

	pcs := NewPersistingChangeSet("test-namespace", store)

	// Record a non-Entity type (should be skipped during persistence)
	pcs.RecordUpsert("just a string")
	pcs.RecordUpsert(123)

	// Also record a valid entity
	pcs.RecordUpsert(testEntity{Type: "user", ID: "1", Name: "Alice"})

	time.Sleep(1500 * time.Millisecond)
	pcs.Close()

	// Only the valid entity should be persisted
	assert.Equal(t, 1, store.TotalChangeCount())
}

func TestPersistingChangeSet_Flush(t *testing.T) {
	store := &mockStore{}

	pcs := NewPersistingChangeSet("test-namespace", store)

	pcs.RecordUpsert(testEntity{Type: "user", ID: "1", Name: "Alice"})

	// Give goroutine time to consume from buffer
	time.Sleep(10 * time.Millisecond)

	// Force flush
	pcs.Commit()

	// Should be persisted immediately
	assert.Equal(t, 1, store.TotalChangeCount())

	pcs.Close()
}

func TestPersistingChangeSet_PauseResume(t *testing.T) {
	store := &mockStore{}

	pcs := NewPersistingChangeSet("test-namespace", store)

	// Record while running
	pcs.RecordUpsert(testEntity{Type: "user", ID: "1", Name: "First"})

	// Pause background processing
	pcs.Pause()
	pcs.RecordUpsert(testEntity{Type: "user", ID: "2", Name: "Paused"})

	// Resume
	pcs.Resume()
	pcs.RecordUpsert(testEntity{Type: "user", ID: "3", Name: "Third"})

	time.Sleep(1500 * time.Millisecond)
	pcs.Close()

	// Only 1 and 3 should be processed (2 was paused)
	assert.Equal(t, 2, store.TotalChangeCount())
}

func TestPersistingChangeSet_Namespace(t *testing.T) {
	store := &mockStore{}

	pcs := NewPersistingChangeSet("my-workspace", store)

	assert.Equal(t, "my-workspace", pcs.Namespace())

	pcs.Close()
}
