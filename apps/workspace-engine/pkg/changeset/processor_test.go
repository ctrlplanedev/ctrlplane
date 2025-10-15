package changeset

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"
)

type TestEntity struct {
	ID   string
	Name string
}

// Test basic processor creation and collection
func TestProcessor_Basic(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity 2"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "3", Name: "Entity 3"})

	processor := NewProcessor(cs)
	changes := processor.Collect()

	if len(changes) != 3 {
		t.Errorf("expected 3 changes, got %d", len(changes))
	}
}

// Test filtering by type
func TestProcessor_FilterByType(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity 2"})
	cs.Record(ChangeTypeCreate, TestEntity{ID: "3", Name: "Entity 3"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "4", Name: "Entity 4"})

	// Filter only creates
	creates := NewProcessor(cs).
		FilterByType(ChangeTypeCreate).
		Collect()

	if len(creates) != 2 {
		t.Errorf("expected 2 creates, got %d", len(creates))
	}

	for _, change := range creates {
		if change.Type != ChangeTypeCreate {
			t.Errorf("expected ChangeTypeCreate, got %v", change.Type)
		}
	}
}

// Test filtering with custom predicate
func TestProcessor_Filter(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Active Entity"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Inactive Entity"})
	cs.Record(ChangeTypeCreate, TestEntity{ID: "3", Name: "Active Entity"})

	// Filter entities with "Active" in name
	actives := NewProcessor(cs).
		Filter(func(c Change[TestEntity]) bool {
			return c.Entity.Name == "Active Entity"
		}).
		Collect()

	if len(actives) != 2 {
		t.Errorf("expected 2 active entities, got %d", len(actives))
	}
}

// Test mapping entities
func TestProcessor_MapEntity(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity"})

	// Transform entity names
	transformed := NewProcessor(cs).
		MapEntity(func(e TestEntity) TestEntity {
			e.Name = e.Name + " (processed)"
			return e
		}).
		Collect()

	for _, change := range transformed {
		if change.Entity.Name != "Entity (processed)" {
			t.Errorf("expected transformed name, got %s", change.Entity.Name)
		}
	}
}

// Test sorting by timestamp
func TestProcessor_SortByTimestamp(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	
	// Record with delays to ensure different timestamps
	cs.Record(ChangeTypeCreate, TestEntity{ID: "3", Name: "Third"})
	time.Sleep(2 * time.Millisecond)
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "1", Name: "First"})
	time.Sleep(2 * time.Millisecond)
	cs.Record(ChangeTypeDelete, TestEntity{ID: "2", Name: "Second"})

	// Sort by timestamp (oldest first)
	sorted := NewProcessor(cs).
		SortByTimestamp().
		Collect()

	// Verify ordering
	for i := 0; i < len(sorted)-1; i++ {
		if sorted[i].Timestamp.After(sorted[i+1].Timestamp) {
			t.Error("timestamps are not in ascending order")
		}
	}
}

// Test sorting by timestamp descending
func TestProcessor_SortByTimestampDesc(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "First"})
	time.Sleep(2 * time.Millisecond)
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Second"})
	time.Sleep(2 * time.Millisecond)
	cs.Record(ChangeTypeDelete, TestEntity{ID: "3", Name: "Third"})

	// Sort by timestamp (newest first)
	sorted := NewProcessor(cs).
		SortByTimestampDesc().
		Collect()

	// Verify ordering
	for i := 0; i < len(sorted)-1; i++ {
		if sorted[i].Timestamp.Before(sorted[i+1].Timestamp) {
			t.Error("timestamps are not in descending order")
		}
	}
}

// Test grouping by type
func TestProcessor_GroupByType(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeCreate, TestEntity{ID: "2", Name: "Entity 2"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "3", Name: "Entity 3"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "4", Name: "Entity 4"})

	groups := NewProcessor(cs).GroupByType()

	if len(groups[ChangeTypeCreate]) != 2 {
		t.Errorf("expected 2 creates, got %d", len(groups[ChangeTypeCreate]))
	}
	if len(groups[ChangeTypeUpdate]) != 1 {
		t.Errorf("expected 1 update, got %d", len(groups[ChangeTypeUpdate]))
	}
	if len(groups[ChangeTypeDelete]) != 1 {
		t.Errorf("expected 1 delete, got %d", len(groups[ChangeTypeDelete]))
	}
}

// Test custom grouping
func TestProcessor_GroupBy(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Group A"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Group A"})
	cs.Record(ChangeTypeCreate, TestEntity{ID: "3", Name: "Group B"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "4", Name: "Group B"})

	groups := NewProcessor(cs).GroupBy(func(c Change[TestEntity]) string {
		return c.Entity.Name
	})

	if len(groups["Group A"]) != 2 {
		t.Errorf("expected 2 in Group A, got %d", len(groups["Group A"]))
	}
	if len(groups["Group B"]) != 2 {
		t.Errorf("expected 2 in Group B, got %d", len(groups["Group B"]))
	}
}

// Test ForEach
func TestProcessor_ForEach(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity 2"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "3", Name: "Entity 3"})

	count := 0
	processor := NewProcessor(cs).ForEach(func(c Change[TestEntity]) error {
		count++
		return nil
	})

	if count != 3 {
		t.Errorf("expected ForEach to be called 3 times, got %d", count)
	}

	if processor.HasErrors() {
		t.Error("expected no errors")
	}
}

// Test ForEach with errors
func TestProcessor_ForEach_WithErrors(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity 2"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "3", Name: "Entity 3"})

	processor := NewProcessor(cs).ForEach(func(c Change[TestEntity]) error {
		if c.Type == ChangeTypeUpdate {
			return errors.New("update error")
		}
		return nil
	})

	if !processor.HasErrors() {
		t.Error("expected errors")
	}

	errors := processor.Errors()
	if len(errors) != 1 {
		t.Errorf("expected 1 error, got %d", len(errors))
	}
}

// Test ForEachWithContext
func TestProcessor_ForEachWithContext(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity 2"})

	ctx := context.Background()
	count := 0

	processor := NewProcessor(cs).ForEachWithContext(ctx, func(ctx context.Context, c Change[TestEntity]) error {
		count++
		return nil
	})

	if count != 2 {
		t.Errorf("expected ForEachWithContext to be called 2 times, got %d", count)
	}

	if processor.HasErrors() {
		t.Error("expected no errors")
	}
}

// Test ForEachWithContext cancellation
func TestProcessor_ForEachWithContext_Cancellation(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	for i := 0; i < 10; i++ {
		cs.Record(ChangeTypeCreate, TestEntity{ID: fmt.Sprintf("%d", i), Name: fmt.Sprintf("Entity %d", i)})
	}

	ctx, cancel := context.WithCancel(context.Background())
	count := 0

	processor := NewProcessor(cs).ForEachWithContext(ctx, func(ctx context.Context, c Change[TestEntity]) error {
		count++
		if count == 3 {
			cancel()
		}
		return nil
	})

	if !processor.HasErrors() {
		t.Error("expected context cancellation error")
	}

	// Should stop processing after context is cancelled
	if count > 4 {
		t.Errorf("expected processing to stop early, but processed %d items", count)
	}
}

// Test Take and Skip
func TestProcessor_TakeAndSkip(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	for i := 1; i <= 10; i++ {
		cs.Record(ChangeTypeCreate, TestEntity{ID: fmt.Sprintf("%d", i), Name: fmt.Sprintf("Entity %d", i)})
	}

	// Take first 5
	first5 := NewProcessor(cs).Take(5).Collect()
	if len(first5) != 5 {
		t.Errorf("expected 5 changes, got %d", len(first5))
	}

	// Skip first 5, take next 3
	middle3 := NewProcessor(cs).Skip(5).Take(3).Collect()
	if len(middle3) != 3 {
		t.Errorf("expected 3 changes, got %d", len(middle3))
	}
}

// Test First and Last
func TestProcessor_FirstAndLast(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "First"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Middle"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "3", Name: "Last"})

	processor := NewProcessor(cs)

	first := processor.First()
	if first == nil || first.Entity.Name != "First" {
		t.Error("First() did not return the first element")
	}

	last := processor.Last()
	if last == nil || last.Entity.Name != "Last" {
		t.Error("Last() did not return the last element")
	}
}

// Test First and Last on empty processor
func TestProcessor_FirstAndLast_Empty(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	processor := NewProcessor(cs)

	first := processor.First()
	if first != nil {
		t.Error("First() should return nil for empty processor")
	}

	last := processor.Last()
	if last != nil {
		t.Error("Last() should return nil for empty processor")
	}
}

// Test Count
func TestProcessor_Count(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity 2"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "3", Name: "Entity 3"})

	count := NewProcessor(cs).Count()
	if count != 3 {
		t.Errorf("expected count 3, got %d", count)
	}

	// Count after filter
	createCount := NewProcessor(cs).FilterByType(ChangeTypeCreate).Count()
	if createCount != 1 {
		t.Errorf("expected create count 1, got %d", createCount)
	}
}

// Test Any
func TestProcessor_Any(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity 2"})

	hasCreate := NewProcessor(cs).Any(func(c Change[TestEntity]) bool {
		return c.Type == ChangeTypeCreate
	})

	if !hasCreate {
		t.Error("expected to find at least one create")
	}

	hasDelete := NewProcessor(cs).Any(func(c Change[TestEntity]) bool {
		return c.Type == ChangeTypeDelete
	})

	if hasDelete {
		t.Error("expected to not find any deletes")
	}
}

// Test All
func TestProcessor_All(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeCreate, TestEntity{ID: "2", Name: "Entity 2"})

	allCreates := NewProcessor(cs).All(func(c Change[TestEntity]) bool {
		return c.Type == ChangeTypeCreate
	})

	if !allCreates {
		t.Error("expected all changes to be creates")
	}

	cs.Record(ChangeTypeUpdate, TestEntity{ID: "3", Name: "Entity 3"})

	stillAllCreates := NewProcessor(cs).All(func(c Change[TestEntity]) bool {
		return c.Type == ChangeTypeCreate
	})

	if stillAllCreates {
		t.Error("expected not all changes to be creates")
	}
}

// Test CollectEntities
func TestProcessor_CollectEntities(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity 2"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "3", Name: "Entity 3"})

	entities := NewProcessor(cs).CollectEntities()

	if len(entities) != 3 {
		t.Errorf("expected 3 entities, got %d", len(entities))
	}

	for i, entity := range entities {
		expectedID := fmt.Sprintf("%d", i+1)
		if entity.ID != expectedID {
			t.Errorf("expected entity ID %s, got %s", expectedID, entity.ID)
		}
	}
}

// Test Reduce
func TestProcessor_Reduce(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeCreate, TestEntity{ID: "2", Name: "Entity 2"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "3", Name: "Entity 3"})

	// Count creates using reduce
	createCount := NewProcessor(cs).Reduce(0, func(acc interface{}, c Change[TestEntity]) interface{} {
		count := acc.(int)
		if c.Type == ChangeTypeCreate {
			return count + 1
		}
		return count
	})

	if createCount.(int) != 2 {
		t.Errorf("expected 2 creates, got %d", createCount.(int))
	}
}

// Test Partition
func TestProcessor_Partition(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity 2"})
	cs.Record(ChangeTypeCreate, TestEntity{ID: "3", Name: "Entity 3"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "4", Name: "Entity 4"})

	creates, nonCreates := NewProcessor(cs).Partition(func(c Change[TestEntity]) bool {
		return c.Type == ChangeTypeCreate
	})

	if len(creates) != 2 {
		t.Errorf("expected 2 creates, got %d", len(creates))
	}

	if len(nonCreates) != 2 {
		t.Errorf("expected 2 non-creates, got %d", len(nonCreates))
	}
}

// Test Distinct
func TestProcessor_Distinct(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeCreate, TestEntity{ID: "2", Name: "Entity 2"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "1", Name: "Entity 1"})

	// Get distinct by ID
	distinct := NewProcessor(cs).
		Distinct(func(c Change[TestEntity]) string {
			return c.Entity.ID
		}).
		Collect()

	if len(distinct) != 2 {
		t.Errorf("expected 2 distinct entities, got %d", len(distinct))
	}
}

// Test Tap
func TestProcessor_Tap(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Entity 1"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Entity 2"})

	tapped := false
	var tappedCount int

	changes := NewProcessor(cs).
		Tap(func(changes []Change[TestEntity]) {
			tapped = true
			tappedCount = len(changes)
		}).
		Collect()

	if !tapped {
		t.Error("Tap function was not called")
	}

	if tappedCount != 2 {
		t.Errorf("expected tapped count 2, got %d", tappedCount)
	}

	if len(changes) != 2 {
		t.Errorf("expected 2 changes after tap, got %d", len(changes))
	}
}

// Test complex chaining
func TestProcessor_ComplexChaining(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Active"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "2", Name: "Inactive"})
	cs.Record(ChangeTypeCreate, TestEntity{ID: "3", Name: "Active"})
	cs.Record(ChangeTypeDelete, TestEntity{ID: "4", Name: "Active"})
	cs.Record(ChangeTypeUpdate, TestEntity{ID: "5", Name: "Active"})

	// Complex chain: filter by type, filter by name, map entities, count
	count := NewProcessor(cs).
		FilterByType(ChangeTypeCreate, ChangeTypeUpdate).
		Filter(func(c Change[TestEntity]) bool {
			return c.Entity.Name == "Active"
		}).
		MapEntity(func(e TestEntity) TestEntity {
			e.Name = e.Name + " (processed)"
			return e
		}).
		Count()

	// Should have 3: two creates and one update, all with "Active" name
	if count != 3 {
		t.Errorf("expected count 3, got %d", count)
	}
}

// Test FilterMapType with type guard (like TypeScript 'is')
func TestProcessor_FilterMapType(t *testing.T) {
	type RawEntity struct {
		Value int
		Valid bool
	}

	type ValidatedEntity struct {
		Number int
	}

	cs := NewChangeSet[RawEntity]()
	cs.Record(ChangeTypeCreate, RawEntity{Value: 42, Valid: true})
	cs.Record(ChangeTypeUpdate, RawEntity{Value: 99, Valid: false})
	cs.Record(ChangeTypeCreate, RawEntity{Value: 100, Valid: true})

	// Type guard function - similar to TypeScript's 'value is Type'
	typeGuard := func(raw RawEntity) (ValidatedEntity, bool) {
		if !raw.Valid {
			return ValidatedEntity{}, false
		}
		return ValidatedEntity{Number: raw.Value}, true
	}

	// Use the standalone function to transform types
	validated := FilterMapType(NewProcessor(cs), typeGuard)

	result := validated.Collect()
	if len(result) != 2 {
		t.Errorf("expected 2 validated entities, got %d", len(result))
	}

	if !validated.HasErrors() {
		t.Error("expected errors from failed type guards")
	}

	// Verify the transformed entities
	for _, change := range result {
		if change.Entity.Number == 0 {
			t.Error("expected non-zero number")
		}
	}
}

// Test FilterMapTypeWithError with detailed error messages
func TestProcessor_FilterMapTypeWithError(t *testing.T) {
	type InputEntity struct {
		Value string
	}

	type OutputEntity struct {
		Number int
	}

	cs := NewChangeSet[InputEntity]()
	cs.Record(ChangeTypeCreate, InputEntity{Value: "42"})
	cs.Record(ChangeTypeUpdate, InputEntity{Value: "not-a-number"})
	cs.Record(ChangeTypeCreate, InputEntity{Value: "100"})
	cs.Record(ChangeTypeDelete, InputEntity{Value: "invalid"})

	// Validator with detailed error messages
	validator := func(input InputEntity) (OutputEntity, error) {
		var num int
		_, err := fmt.Sscanf(input.Value, "%d", &num)
		if err != nil {
			return OutputEntity{}, fmt.Errorf("failed to parse '%s': %w", input.Value, err)
		}
		return OutputEntity{Number: num}, nil
	}

	// Transform with error handling
	transformed := FilterMapTypeWithError(NewProcessor(cs), validator)

	result := transformed.Collect()
	if len(result) != 2 {
		t.Errorf("expected 2 valid transformations, got %d", len(result))
	}

	if !transformed.HasErrors() {
		t.Error("expected transformation errors")
	}

	errors := transformed.Errors()
	if len(errors) != 2 {
		t.Errorf("expected 2 errors, got %d", len(errors))
	}

	// Verify transformed entities
	for _, change := range result {
		if change.Entity.Number == 0 {
			t.Error("expected non-zero number")
		}
	}
}

// Test type guard with complex validation
func TestProcessor_TypeGuardWithValidation(t *testing.T) {
	type UnvalidatedConfig struct {
		Raw map[string]string
	}

	type ValidatedConfig struct {
		Host string
		Port int
	}

	cs := NewChangeSet[UnvalidatedConfig]()
	cs.Record(ChangeTypeCreate, UnvalidatedConfig{Raw: map[string]string{"host": "localhost", "port": "8080"}})
	cs.Record(ChangeTypeUpdate, UnvalidatedConfig{Raw: map[string]string{"host": "example.com"}}) // Missing port
	cs.Record(ChangeTypeCreate, UnvalidatedConfig{Raw: map[string]string{"host": "api.test", "port": "3000"}})

	// Type guard with validation logic
	guard := func(raw UnvalidatedConfig) (ValidatedConfig, bool) {
		host, hasHost := raw.Raw["host"]
		portStr, hasPort := raw.Raw["port"]
		
		if !hasHost || !hasPort {
			return ValidatedConfig{}, false
		}

		var port int
		if _, err := fmt.Sscanf(portStr, "%d", &port); err != nil {
			return ValidatedConfig{}, false
		}

		return ValidatedConfig{Host: host, Port: port}, true
	}

	validated := FilterMapType(NewProcessor(cs), guard)

	configs := validated.Collect()
	if len(configs) != 2 {
		t.Errorf("expected 2 valid configs, got %d", len(configs))
	}

	for _, change := range configs {
		if change.Entity.Host == "" || change.Entity.Port == 0 {
			t.Error("expected valid host and port")
		}
	}

	if !validated.HasErrors() {
		t.Error("expected validation errors")
	}
}

// Test chaining after type transformation
func TestProcessor_TypeTransformationChaining(t *testing.T) {
	type StringEntity struct {
		Value string
	}

	type IntEntity struct {
		Number int
	}

	cs := NewChangeSet[StringEntity]()
	cs.Record(ChangeTypeCreate, StringEntity{Value: "10"})
	cs.Record(ChangeTypeCreate, StringEntity{Value: "20"})
	cs.Record(ChangeTypeUpdate, StringEntity{Value: "30"})
	cs.Record(ChangeTypeCreate, StringEntity{Value: "invalid"})

	// Transform and continue chaining
	validator := func(s StringEntity) (IntEntity, error) {
		var num int
		_, err := fmt.Sscanf(s.Value, "%d", &num)
		if err != nil {
			return IntEntity{}, err
		}
		return IntEntity{Number: num}, nil
	}

	// Chain operations after type transformation
	result := FilterMapTypeWithError(NewProcessor(cs), validator).
		FilterByType(ChangeTypeCreate).
		Filter(func(c Change[IntEntity]) bool {
			return c.Entity.Number > 10
		}).
		CollectEntities()

	if len(result) != 1 {
		t.Errorf("expected 1 entity after chaining, got %d", len(result))
	}

	if result[0].Number != 20 {
		t.Errorf("expected number 20, got %d", result[0].Number)
	}
}

// Test processor doesn't modify original changeset
func TestProcessor_ImmutableSource(t *testing.T) {
	cs := NewChangeSet[TestEntity]()
	cs.Record(ChangeTypeCreate, TestEntity{ID: "1", Name: "Original"})

	// Process and modify
	NewProcessor(cs).
		MapEntity(func(e TestEntity) TestEntity {
			e.Name = "Modified"
			return e
		}).
		Collect()

	// Original changeset should be unchanged
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	if cs.Changes[0].Entity.Name != "Original" {
		t.Error("processor modified the original changeset")
	}
}

