package evaluator

import (
	"context"
	"fmt"
	"sync"

	selectorengine "workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/resource"
	"workspace-engine/pkg/model/selector"
)

// ResourceEntity adapts resource.Resource to implement MatchableEntity
type ResourceEntity struct {
	resource.Resource
}

func (r ResourceEntity) GetID() string {
	return r.Resource.ID
}

func (r ResourceEntity) GetWorkspaceID() string {
	return r.Resource.WorkspaceID
}

// ResourceSelectorEntity adapts selector.ResourceSelector to implement Selector
type ResourceSelectorEntity struct {
	selector.ResourceSelector
}

func (s ResourceSelectorEntity) GetID() string {
	return s.ResourceSelector.ID
}

func (s ResourceSelectorEntity) GetWorkspaceID() string {
	return s.ResourceSelector.WorkspaceID
}

func (s ResourceSelectorEntity) Conditions() []selector.Condition {
	return []selector.Condition{s.ResourceSelector.Condition}
}

// Engine implements the SelectorEngine interface using direct evaluation
type Engine struct {
	mu             sync.RWMutex
	entities       map[string]ResourceEntity
	selectors      map[string]ResourceSelectorEntity
	currentMatches map[string]map[string]bool // selectorID -> entityID -> isMatched
	onMatchChange  func(ctx context.Context, change selectorengine.MatchChange) error
}

// NewEngine creates a new evaluator-based selector engine
func NewEngine() selectorengine.SelectorEngine[ResourceEntity, ResourceSelectorEntity] {
	return &Engine{
		entities:       make(map[string]ResourceEntity),
		selectors:      make(map[string]ResourceSelectorEntity),
		currentMatches: make(map[string]map[string]bool),
	}
}

// LoadEntities loads multiple entities into the engine
func (e *Engine) LoadEntities(ctx context.Context, entities []ResourceEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, entity := range entities {
		e.entities[entity.GetID()] = entity
	}

	return e.evaluateAllMatches(ctx)
}

// UpsertEntity adds or updates an entity in the engine
func (e *Engine) UpsertEntity(ctx context.Context, entity ResourceEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.entities[entity.GetID()] = entity
	return e.evaluateEntityMatches(ctx, entity)
}

// RemoveEntities removes multiple entities from the engine
func (e *Engine) RemoveEntities(ctx context.Context, entities []ResourceEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, entity := range entities {
		delete(e.entities, entity.GetID())
		if err := e.removeEntityMatches(ctx, entity); err != nil {
			return err
		}
	}

	return nil
}

// RemoveEntity removes an entity from the engine
func (e *Engine) RemoveEntity(ctx context.Context, entity ResourceEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	delete(e.entities, entity.GetID())
	return e.removeEntityMatches(ctx, entity)
}

// LoadSelectors loads multiple selectors into the engine
func (e *Engine) LoadSelectors(ctx context.Context, selectors []ResourceSelectorEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, sel := range selectors {
		e.selectors[sel.GetID()] = sel
		if e.currentMatches[sel.GetID()] == nil {
			e.currentMatches[sel.GetID()] = make(map[string]bool)
		}
	}

	return e.evaluateAllMatches(ctx)
}

// UpsertSelector adds or updates a selector in the engine
func (e *Engine) UpsertSelector(ctx context.Context, sel ResourceSelectorEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.selectors[sel.GetID()] = sel
	if e.currentMatches[sel.GetID()] == nil {
		e.currentMatches[sel.GetID()] = make(map[string]bool)
	}

	return e.evaluateSelectorMatches(ctx, sel)
}

// RemoveSelectors removes multiple selectors from the engine
func (e *Engine) RemoveSelectors(ctx context.Context, selectors []ResourceSelectorEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	for _, sel := range selectors {
		if err := e.removeSelectorMatches(ctx, sel); err != nil {
			return err
		}
		delete(e.selectors, sel.GetID())
		delete(e.currentMatches, sel.GetID())
	}

	return nil
}

// RemoveSelector removes a selector from the engine
func (e *Engine) RemoveSelector(ctx context.Context, sel ResourceSelectorEntity) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	if err := e.removeSelectorMatches(ctx, sel); err != nil {
		return err
	}
	delete(e.selectors, sel.GetID())
	delete(e.currentMatches, sel.GetID())

	return nil
}

// OnMatchChange sets the callback function for match changes
func (e *Engine) OnMatchChange(cb func(ctx context.Context, change selectorengine.MatchChange) error) error {
	e.mu.Lock()
	defer e.mu.Unlock()

	e.onMatchChange = cb
	return nil
}

// evaluateAllMatches re-evaluates all entity-selector combinations
func (e *Engine) evaluateAllMatches(ctx context.Context) error {
	for _, entity := range e.entities {
		if err := e.evaluateEntityMatches(ctx, entity); err != nil {
			return err
		}
	}
	return nil
}

// evaluateEntityMatches evaluates an entity against all selectors
func (e *Engine) evaluateEntityMatches(ctx context.Context, entity ResourceEntity) error {
	for _, sel := range e.selectors {
		if err := e.evaluateMatch(ctx, entity, sel); err != nil {
			return err
		}
	}
	return nil
}

// evaluateSelectorMatches evaluates a selector against all entities
func (e *Engine) evaluateSelectorMatches(ctx context.Context, sel ResourceSelectorEntity) error {
	for _, entity := range e.entities {
		if err := e.evaluateMatch(ctx, entity, sel); err != nil {
			return err
		}
	}
	return nil
}

// evaluateMatch evaluates if an entity matches a selector and handles state changes
func (e *Engine) evaluateMatch(ctx context.Context, entity ResourceEntity, sel ResourceSelectorEntity) error {
	// Skip if workspace doesn't match
	if entity.GetWorkspaceID() != sel.GetWorkspaceID() {
		return nil
	}

	// Evaluate the condition
	matches, err := sel.ResourceSelector.Condition.Matches(entity.Resource)
	if err != nil {
		return fmt.Errorf("error evaluating condition for selector %s and entity %s: %w", sel.GetID(), entity.GetID(), err)
	}

	// Get current match state
	currentlyMatches := e.currentMatches[sel.GetID()][entity.GetID()]

	// If state changed, update and trigger callback
	if matches != currentlyMatches {
		e.currentMatches[sel.GetID()][entity.GetID()] = matches

		if e.onMatchChange != nil {
			changeType := selectorengine.MatchChangeTypeAdded
			if !matches {
				changeType = selectorengine.MatchChangeTypeRemoved
			}

			change := selectorengine.MatchChange{
				Entity:     entity,
				Selector:   sel,
				ChangeType: changeType,
			}

			if err := e.onMatchChange(ctx, change); err != nil {
				return fmt.Errorf("error in match change callback: %w", err)
			}
		}
	}

	return nil
}

// removeEntityMatches removes all matches for an entity
func (e *Engine) removeEntityMatches(ctx context.Context, entity ResourceEntity) error {
	for selectorID, matches := range e.currentMatches {
		if matches[entity.GetID()] {
			// Entity was matching, trigger remove event
			sel, exists := e.selectors[selectorID]
			if exists && e.onMatchChange != nil {
				change := selectorengine.MatchChange{
					Entity:     entity,
					Selector:   sel,
					ChangeType: selectorengine.MatchChangeTypeRemoved,
				}

				if err := e.onMatchChange(ctx, change); err != nil {
					return fmt.Errorf("error in match change callback: %w", err)
				}
			}
		}
		delete(matches, entity.GetID())
	}
	return nil
}

// removeSelectorMatches removes all matches for a selector
func (e *Engine) removeSelectorMatches(ctx context.Context, sel ResourceSelectorEntity) error {
	matches := e.currentMatches[sel.GetID()]
	for entityID, isMatched := range matches {
		if isMatched {
			// Entity was matching, trigger remove event
			entity, exists := e.entities[entityID]
			if exists && e.onMatchChange != nil {
				change := selectorengine.MatchChange{
					Entity:     entity,
					Selector:   sel,
					ChangeType: selectorengine.MatchChangeTypeRemoved,
				}

				if err := e.onMatchChange(ctx, change); err != nil {
					return fmt.Errorf("error in match change callback: %w", err)
				}
			}
		}
	}
	return nil
}

// Helper functions for creating wrapper types
func WrapResource(res resource.Resource) ResourceEntity {
	return ResourceEntity{Resource: res}
}

func WrapSelector(sel selector.ResourceSelector) ResourceSelectorEntity {
	return ResourceSelectorEntity{ResourceSelector: sel}
}

func WrapResources(resources []resource.Resource) []ResourceEntity {
	wrapped := make([]ResourceEntity, len(resources))
	for i, res := range resources {
		wrapped[i] = WrapResource(res)
	}
	return wrapped
}

func WrapSelectors(selectors []selector.ResourceSelector) []ResourceSelectorEntity {
	wrapped := make([]ResourceSelectorEntity, len(selectors))
	for i, sel := range selectors {
		wrapped[i] = WrapSelector(sel)
	}
	return wrapped
}
