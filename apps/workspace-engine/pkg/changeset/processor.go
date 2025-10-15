package changeset

import (
	"context"
	"fmt"
	"sort"
)

// Processor provides a fluent API for processing changesets
type Processor[T any] struct {
	changes []Change[T]
	errors  []error
}

// NewProcessor creates a new processor from a changeset
func NewProcessor[T any](cs *ChangeSet[T]) *Processor[T] {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	// Create a copy of the changes to avoid modification issues
	changes := make([]Change[T], len(cs.Changes))
	copy(changes, cs.Changes)

	return &Processor[T]{
		changes: changes,
		errors:  make([]error, 0),
	}
}

// NewProcessorFromSlice creates a new processor from a slice of changes
func NewProcessorFromSlice[T any](changes []Change[T]) *Processor[T] {
	changesCopy := make([]Change[T], len(changes))
	copy(changesCopy, changes)

	return &Processor[T]{
		changes: changesCopy,
		errors:  make([]error, 0),
	}
}

// Filter returns a new processor with only changes matching the predicate
func (p *Processor[T]) Filter(predicate func(Change[T]) bool) *Processor[T] {
	filtered := make([]Change[T], 0)
	for _, change := range p.changes {
		if predicate(change) {
			filtered = append(filtered, change)
		}
	}

	return &Processor[T]{
		changes: filtered,
		errors:  p.errors,
	}
}

// FilterByType returns a new processor with only changes of the specified type(s)
func (p *Processor[T]) FilterByType(types ...ChangeType) *Processor[T] {
	typeMap := make(map[ChangeType]bool)
	for _, t := range types {
		typeMap[t] = true
	}

	return p.Filter(func(c Change[T]) bool {
		return typeMap[c.Type]
	})
}

// Map transforms each change using the provided function
func (p *Processor[T]) Map(mapper func(Change[T]) Change[T]) *Processor[T] {
	mapped := make([]Change[T], len(p.changes))
	for i, change := range p.changes {
		mapped[i] = mapper(change)
	}

	return &Processor[T]{
		changes: mapped,
		errors:  p.errors,
	}
}

// MapEntity transforms the entity of each change
func (p *Processor[T]) MapEntity(mapper func(T) T) *Processor[T] {
	return p.Map(func(c Change[T]) Change[T] {
		c.Entity = mapper(c.Entity)
		return c
	})
}

// Validate filters changes based on a validation function
// Invalid changes are filtered out and their errors are collected
func (p *Processor[T]) Validate(validator func(Change[T]) error) *Processor[T] {
	validated := make([]Change[T], 0)
	errors := make([]error, 0)
	errors = append(errors, p.errors...)

	for _, change := range p.changes {
		if err := validator(change); err != nil {
			errors = append(errors, err)
		} else {
			validated = append(validated, change)
		}
	}

	return &Processor[T]{
		changes: validated,
		errors:  errors,
	}
}

// ValidateEntity filters changes based on entity validation
// Invalid entities are filtered out and their errors are collected
func (p *Processor[T]) ValidateEntity(validator func(T) error) *Processor[T] {
	return p.Validate(func(c Change[T]) error {
		return validator(c.Entity)
	})
}

// TypeGuard is a function that checks if an entity is of a specific type
// Similar to TypeScript's type guard (value is Type)
type TypeGuard[T any, U any] func(T) (U, bool)

// FilterMapType validates and transforms changes to a new type using a type guard
// Similar to TypeScript's type narrowing with 'is' operator
// Returns a new processor with the transformed type
func FilterMapType[T any, U any](p *Processor[T], guard TypeGuard[T, U]) *Processor[U] {
	mapped := make([]Change[U], 0)
	errors := make([]error, 0)
	errors = append(errors, p.errors...)

	for _, change := range p.changes {
		if validated, ok := guard(change.Entity); ok {
			mapped = append(mapped, Change[U]{
				Type:      change.Type,
				Entity:    validated,
				Timestamp: change.Timestamp,
			})
		} else {
			errors = append(errors, fmt.Errorf("type guard failed for entity"))
		}
	}

	return &Processor[U]{
		changes: mapped,
		errors:  errors,
	}
}

// FilterMapTypeWithError validates and transforms changes to a new type with error details
// Returns a new processor with the transformed type, collecting validation errors
func FilterMapTypeWithError[T any, U any](p *Processor[T], validator func(T) (U, error)) *Processor[U] {
	mapped := make([]Change[U], 0)
	errors := make([]error, 0)
	errors = append(errors, p.errors...)

	for _, change := range p.changes {
		validated, err := validator(change.Entity)
		if err != nil {
			errors = append(errors, err)
		} else {
			mapped = append(mapped, Change[U]{
				Type:      change.Type,
				Entity:    validated,
				Timestamp: change.Timestamp,
			})
		}
	}

	return &Processor[U]{
		changes: mapped,
		errors:  errors,
	}
}

// SortBy sorts changes using the provided comparison function
func (p *Processor[T]) SortBy(less func(Change[T], Change[T]) bool) *Processor[T] {
	sorted := make([]Change[T], len(p.changes))
	copy(sorted, p.changes)

	sort.Slice(sorted, func(i, j int) bool {
		return less(sorted[i], sorted[j])
	})

	return &Processor[T]{
		changes: sorted,
		errors:  p.errors,
	}
}

// SortByTimestamp sorts changes by timestamp (oldest first)
func (p *Processor[T]) SortByTimestamp() *Processor[T] {
	return p.SortBy(func(a, b Change[T]) bool {
		return a.Timestamp.Before(b.Timestamp)
	})
}

// SortByTimestampDesc sorts changes by timestamp (newest first)
func (p *Processor[T]) SortByTimestampDesc() *Processor[T] {
	return p.SortBy(func(a, b Change[T]) bool {
		return a.Timestamp.After(b.Timestamp)
	})
}

// GroupBy groups changes by a key extracted from each change
func (p *Processor[T]) GroupBy(keyFunc func(Change[T]) string) map[string][]Change[T] {
	groups := make(map[string][]Change[T])
	for _, change := range p.changes {
		key := keyFunc(change)
		groups[key] = append(groups[key], change)
	}
	return groups
}

// GroupByType groups changes by their ChangeType
func (p *Processor[T]) GroupByType() map[ChangeType][]Change[T] {
	groups := make(map[ChangeType][]Change[T])
	for _, change := range p.changes {
		groups[change.Type] = append(groups[change.Type], change)
	}
	return groups
}

// ForEach applies a function to each change, collecting any errors
func (p *Processor[T]) ForEach(fn func(Change[T]) error) *Processor[T] {
	for _, change := range p.changes {
		if err := fn(change); err != nil {
			p.errors = append(p.errors, err)
		}
	}
	return p
}

// ForEachWithContext applies a function with context to each change
func (p *Processor[T]) ForEachWithContext(ctx context.Context, fn func(context.Context, Change[T]) error) *Processor[T] {
	for _, change := range p.changes {
		select {
		case <-ctx.Done():
			p.errors = append(p.errors, ctx.Err())
			return p
		default:
			if err := fn(ctx, change); err != nil {
				p.errors = append(p.errors, err)
			}
		}
	}
	return p
}

// Tap allows inspection of changes without modifying them
func (p *Processor[T]) Tap(fn func([]Change[T])) *Processor[T] {
	fn(p.changes)
	return p
}

// Take returns a new processor with at most n changes
func (p *Processor[T]) Take(n int) *Processor[T] {
	if n > len(p.changes) {
		n = len(p.changes)
	}

	taken := make([]Change[T], n)
	copy(taken, p.changes[:n])

	return &Processor[T]{
		changes: taken,
		errors:  p.errors,
	}
}

// Skip returns a new processor skipping the first n changes
func (p *Processor[T]) Skip(n int) *Processor[T] {
	if n > len(p.changes) {
		n = len(p.changes)
	}

	skipped := make([]Change[T], len(p.changes)-n)
	copy(skipped, p.changes[n:])

	return &Processor[T]{
		changes: skipped,
		errors:  p.errors,
	}
}

// First returns the first change, if any
func (p *Processor[T]) First() *Change[T] {
	if len(p.changes) == 0 {
		return nil
	}
	return &p.changes[0]
}

// Last returns the last change, if any
func (p *Processor[T]) Last() *Change[T] {
	if len(p.changes) == 0 {
		return nil
	}
	return &p.changes[len(p.changes)-1]
}

// Count returns the number of changes
func (p *Processor[T]) Count() int {
	return len(p.changes)
}

// Any returns true if at least one change matches the predicate
func (p *Processor[T]) Any(predicate func(Change[T]) bool) bool {
	for _, change := range p.changes {
		if predicate(change) {
			return true
		}
	}
	return false
}

// All returns true if all changes match the predicate
func (p *Processor[T]) All(predicate func(Change[T]) bool) bool {
	for _, change := range p.changes {
		if !predicate(change) {
			return false
		}
	}
	return true
}

// Collect returns the processed changes
func (p *Processor[T]) Collect() []Change[T] {
	result := make([]Change[T], len(p.changes))
	copy(result, p.changes)
	return result
}

// CollectEntities returns just the entities from the changes
func (p *Processor[T]) CollectEntities() []T {
	entities := make([]T, len(p.changes))
	for i, change := range p.changes {
		entities[i] = change.Entity
	}
	return entities
}

// Errors returns any errors collected during processing
func (p *Processor[T]) Errors() []error {
	return p.errors
}

// HasErrors returns true if any errors were collected
func (p *Processor[T]) HasErrors() bool {
	return len(p.errors) > 0
}

// Reduce reduces the changes to a single value
func (p *Processor[T]) Reduce(initial interface{}, reducer func(acc interface{}, change Change[T]) interface{}) interface{} {
	acc := initial
	for _, change := range p.changes {
		acc = reducer(acc, change)
	}
	return acc
}

// Partition splits changes into two groups based on a predicate
func (p *Processor[T]) Partition(predicate func(Change[T]) bool) (matching []Change[T], notMatching []Change[T]) {
	for _, change := range p.changes {
		if predicate(change) {
			matching = append(matching, change)
		} else {
			notMatching = append(notMatching, change)
		}
	}
	return matching, notMatching
}

// Distinct removes duplicate changes based on a key function
func (p *Processor[T]) Distinct(keyFunc func(Change[T]) string) *Processor[T] {
	seen := make(map[string]bool)
	unique := make([]Change[T], 0)

	for _, change := range p.changes {
		key := keyFunc(change)
		if !seen[key] {
			seen[key] = true
			unique = append(unique, change)
		}
	}

	return &Processor[T]{
		changes: unique,
		errors:  p.errors,
	}
}
