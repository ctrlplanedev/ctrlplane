package exhaustive

import (
	"context"
	"fmt"
	"sync"
	"workspace-engine/pkg/engine/selector"
)

type ExhaustiveConfig struct {
	IsNilConditionAMatch bool
}

// Exhaustive implements the SelectorEngine interface
type Exhaustive struct {
	// Storage for entities and selectors
	entities  map[string]selector.MatchableEntity
	selectors map[string]selector.Selector

	// Track current matches between entities and selectors
	matches map[string]map[string]bool // matches[entityID][selectorID] = isMatched

	// Subscribers to match changes
	subscribers []selector.MatchChangesHandler

	config ExhaustiveConfig

	// Mutex for thread safety
	mu sync.RWMutex
}

// NewExhaustive creates a new exhaustive instance
func NewExhaustive() *Exhaustive {
	return &Exhaustive{
		entities:    make(map[string]selector.MatchableEntity),
		selectors:   make(map[string]selector.Selector),
		matches:     make(map[string]map[string]bool),
		subscribers: make([]selector.MatchChangesHandler, 0),
		config: ExhaustiveConfig{
			IsNilConditionAMatch: true,
		},
	}
}

func NewExhaustiveWithConfig(config ExhaustiveConfig) *Exhaustive {
	return &Exhaustive{
		entities:    make(map[string]selector.MatchableEntity),
		selectors:   make(map[string]selector.Selector),
		matches:     make(map[string]map[string]bool),
		subscribers: make([]selector.MatchChangesHandler, 0),
		config:      config,
	}
}

// LoadEntities loads multiple entities into the exhaustive engine
func (e *Exhaustive) LoadEntities(ctx context.Context, entities []selector.BaseEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, entity := range entities {
		e.entities[entity.GetID()] = entity
		if e.matches[entity.GetID()] == nil {
			e.matches[entity.GetID()] = make(map[string]bool)
		}

		// Evaluate against all existing selectors
		for _, sel := range e.selectors {
			if err := e.evaluateMatch(ctx, entity, sel); err != nil {
				return fmt.Errorf("failed to evaluate match for entity %s: %w", entity.GetID(), err)
			}
		}
	}

	return nil
}

// UpsertEntity adds or updates an entity
func (e *Exhaustive) UpsertEntity(ctx context.Context, entity selector.BaseEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.entities[entity.GetID()] = entity
	if e.matches[entity.GetID()] == nil {
		e.matches[entity.GetID()] = make(map[string]bool)
	}

	// Evaluate against all selectors
	for _, sel := range e.selectors {
		if err := e.evaluateMatch(ctx, entity, sel); err != nil {
			return fmt.Errorf("failed to evaluate match for entity %s: %w", entity.GetID(), err)
		}
	}

	return nil
}

// RemoveEntities removes multiple entities
func (e *Exhaustive) RemoveEntities(ctx context.Context, entities []selector.BaseEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, entity := range entities {
		if err := e.removeEntity(ctx, entity); err != nil {
			return err
		}
	}

	return nil
}

// RemoveEntity removes a single entity
func (e *Exhaustive) RemoveEntity(ctx context.Context, entity selector.BaseEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	return e.removeEntity(ctx, entity)
}

// removeEntity internal helper for removing entities (assumes lock is held)
func (e *Exhaustive) removeEntity(ctx context.Context, entity selector.BaseEntity) error {
	entityID := entity.GetID()

	// Notify subscribers of removed matches
	if matches, exists := e.matches[entityID]; exists {
		for selectorID, wasMatched := range matches {
			if wasMatched {
				if sel, selectorExists := e.selectors[selectorID]; selectorExists {
					change := selector.MatchChange{
						Entity:     entity,
						Selector:   sel,
						ChangeType: selector.MatchChangeTypeRemoved,
					}
					e.notifySubscribers(ctx, change)
				}
			}
		}
	}

	delete(e.entities, entityID)
	delete(e.matches, entityID)

	return nil
}

// LoadSelectors loads multiple selectors
func (e *Exhaustive) LoadSelectors(ctx context.Context, selectors []selector.BaseSelector) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, sel := range selectors {
		e.selectors[sel.GetID()] = sel

		// Evaluate against all existing entities
		for _, entity := range e.entities {
			if err := e.evaluateMatch(ctx, entity, sel); err != nil {
				return fmt.Errorf("failed to evaluate match for selector %s: %w", sel.GetID(), err)
			}
		}
	}

	return nil
}

// UpsertSelector adds or updates a selector
func (e *Exhaustive) UpsertSelector(ctx context.Context, sel selector.BaseSelector) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.selectors[sel.GetID()] = sel

	// Evaluate against all entities
	for _, entity := range e.entities {
		if err := e.evaluateMatch(ctx, entity, sel); err != nil {
			return fmt.Errorf("failed to evaluate match for selector %s: %w", sel.GetID(), err)
		}
	}

	return nil
}

// RemoveSelectors removes multiple selectors
func (e *Exhaustive) RemoveSelectors(ctx context.Context, selectors []selector.BaseSelector) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, sel := range selectors {
		if err := e.removeSelector(ctx, sel); err != nil {
			return err
		}
	}

	return nil
}

// RemoveSelector removes a single selector
func (e *Exhaustive) RemoveSelector(ctx context.Context, sel selector.BaseSelector) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	return e.removeSelector(ctx, sel)
}

// removeSelector internal helper for removing selectors (assumes lock is held)
func (e *Exhaustive) removeSelector(ctx context.Context, sel selector.BaseSelector) error {
	selectorID := sel.GetID()

	// Notify subscribers of removed matches
	for entityID, matches := range e.matches {
		if wasMatched, exists := matches[selectorID]; exists && wasMatched {
			if entity, entityExists := e.entities[entityID]; entityExists {
				change := selector.MatchChange{
					Entity:     entity,
					Selector:   sel,
					ChangeType: selector.MatchChangeTypeRemoved,
				}
				e.notifySubscribers(ctx, change)
			}
			delete(matches, selectorID)
		}
	}

	delete(e.selectors, selectorID)

	return nil
}

// GetSelectorsForEntity returns all selectors that match the given entity
func (e *Exhaustive) GetSelectorsForEntity(ctx context.Context, entity selector.BaseEntity) ([]selector.BaseSelector, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var matchingSelectors []selector.BaseSelector
	entityID := entity.GetID()

	if matches, exists := e.matches[entityID]; exists {
		for selectorID, isMatched := range matches {
			if isMatched {
				if sel, selectorExists := e.selectors[selectorID]; selectorExists {
					if baseSelector, ok := sel.(selector.BaseSelector); ok {
						matchingSelectors = append(matchingSelectors, baseSelector)
					}
				}
			}
		}
	}

	return matchingSelectors, nil
}

// GetEntitiesForSelector returns all entities that match the given selector
func (e *Exhaustive) GetEntitiesForSelector(ctx context.Context, sel selector.BaseSelector) ([]selector.BaseEntity, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	var matchingEntities []selector.BaseEntity
	selectorID := sel.GetID()

	for entityID, matches := range e.matches {
		if isMatched, exists := matches[selectorID]; exists && isMatched {
			if entity, entityExists := e.entities[entityID]; entityExists {
				if baseEntity, ok := entity.(selector.BaseEntity); ok {
					matchingEntities = append(matchingEntities, baseEntity)
				}
			}
		}
	}

	return matchingEntities, nil
}

// SubscribeToMatchChanges registers a callback for match change events
func (e *Exhaustive) SubscribeToMatchChanges(handler func(ctx context.Context, change selector.MatchChange) error) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.subscribers = append(e.subscribers, handler)
	return nil
}

// evaluateMatch evaluates if an entity matches a selector and handles state changes
func (e *Exhaustive) evaluateMatch(
	ctx context.Context,
	entity selector.MatchableEntity,
	sel selector.Selector,
) error {
	entityID := entity.GetID()
	selectorID := sel.GetID()

	// Ensure entity has match tracking initialized
	if e.matches[entityID] == nil {
		e.matches[entityID] = make(map[string]bool)
	}

	// Get current match state
	wasMatched := e.matches[entityID][selectorID]

	// Evaluate current match using selector conditions
	isMatched, err := e.evaluateConditions(entity, sel.GetConditions())
	if err != nil {
		return fmt.Errorf("failed to evaluate conditions: %w", err)
	}

	// Update match state
	e.matches[entityID][selectorID] = isMatched

	// Notify subscribers if match state changed
	if wasMatched != isMatched {
		changeType := selector.MatchChangeTypeAdded
		if !isMatched {
			changeType = selector.MatchChangeTypeRemoved
		}

		change := selector.MatchChange{
			Entity:     entity,
			Selector:   sel,
			ChangeType: changeType,
		}

		e.notifySubscribers(ctx, change)
	}

	return nil
}

// evaluateConditions evaluates conditions against an entity using operation functions
func (e *Exhaustive) evaluateConditions(entity selector.MatchableEntity, condition selector.Condition) (bool, error) {
	if condition == nil {
		return e.config.IsNilConditionAMatch, nil // No conditions means always match
	}

	return condition.Matches(entity)
}

// notifySubscribers notifies all registered subscribers of match changes
func (e *Exhaustive) notifySubscribers(ctx context.Context, change selector.MatchChange) {
	for _, subscriber := range e.subscribers {
		// Execute subscriber in a goroutine to avoid blocking
		go func(sub func(ctx context.Context, change selector.MatchChange) error) {
			if err := sub(ctx, change); err != nil {
				// Log error but don't stop other subscribers
				// You might want to add proper logging here
				fmt.Printf("Subscriber error: %v\n", err)
			}
		}(subscriber)
	}
}
