package exhaustive

import (
	"context"
	"sync"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/engine/selector/exhaustive/operations"
	"workspace-engine/pkg/model"
)

// Exhaustive implements the SelectorEngine interface
type Exhaustive[E model.MatchableEntity, S model.SelectorEntity] struct {
	// Storage for entities and selectors
	entities  map[string]E
	selectors map[string]S

	// Track current matches between entities and selectors
	matches map[string]map[string]bool // matches[entityID][selectorID] = isMatched

	// Mutex for thread safety
	mu sync.RWMutex
}

// NewExhaustive creates a new exhaustive instance
func NewExhaustive[E model.MatchableEntity, S model.SelectorEntity]() *Exhaustive[E, S] {
	return &Exhaustive[E, S]{
		entities:  make(map[string]E),
		selectors: make(map[string]S),
		matches:   make(map[string]map[string]bool),
	}
}

func (e *Exhaustive[E, S]) getMatchChangeType(matchResult bool) selector.MatchChangeType {
	if matchResult {
		return selector.MatchChangeTypeAdded
	}
	return selector.MatchChangeTypeRemoved
}

func (e *Exhaustive[E, S]) handleEntitySelectorPair(ent E, sel S) *selector.ChannelResult[E, S] {
	wasPreviouslyMatched := e.matches[ent.GetID()][sel.GetID()]
	selectorCondition, err := sel.Selector(ent)
	if err != nil {
		return &selector.ChannelResult[E, S]{Error: err}
	}

	matchResult, err := operations.JSONSelector{
		JSONCondition: selectorCondition,
	}.Matches(ent)
	if err != nil {
		return &selector.ChannelResult[E, S]{Error: err}
	}

	e.matches[ent.GetID()][sel.GetID()] = matchResult

	if matchResult == wasPreviouslyMatched {
		return nil
	}

	return &selector.ChannelResult[E, S]{
		MatchChange: &selector.MatchChange[E, S]{
			Entity:     ent,
			Selector:   sel,
			ChangeType: e.getMatchChangeType(matchResult),
		},
	}
}

func (e *Exhaustive[E, S]) UpsertEntity(ctx context.Context, entity ...E) <-chan selector.ChannelResult[E, S] {
	channel := make(chan selector.ChannelResult[E, S])

	go func() {
		e.mu.Lock()
		defer e.mu.Unlock()
		defer close(channel)

		for _, ent := range entity {
			e.entities[ent.GetID()] = ent
			if e.matches[ent.GetID()] == nil {
				e.matches[ent.GetID()] = make(map[string]bool)
			}

			for _, sel := range e.selectors {
				channelResult := e.handleEntitySelectorPair(ent, sel)
				if channelResult != nil {
					channel <- *channelResult
				}
			}
		}
	}()

	return channel
}

func (e *Exhaustive[E, S]) RemoveEntity(ctx context.Context, entity ...E) <-chan selector.ChannelResult[E, S] {
	channel := make(chan selector.ChannelResult[E, S])

	go func() {
		e.mu.Lock()
		defer e.mu.Unlock()
		defer close(channel)

		for _, ent := range entity {
			matchEntries := e.matches[ent.GetID()]
			for setID, wasPreviouslyMatched := range matchEntries {
				if !wasPreviouslyMatched {
					continue
				}

				sel, ok := e.selectors[setID]
				if !ok {
					continue
				}

				channel <- selector.ChannelResult[E, S]{
					MatchChange: &selector.MatchChange[E, S]{
						Entity:     ent,
						Selector:   sel,
						ChangeType: selector.MatchChangeTypeRemoved,
					},
				}
			}

			delete(e.matches, ent.GetID())
		}
	}()

	return channel
}

func (e *Exhaustive[E, S]) UpsertSelector(ctx context.Context, sel ...S) <-chan selector.ChannelResult[E, S] {
	channel := make(chan selector.ChannelResult[E, S])

	go func() {
		e.mu.Lock()
		defer e.mu.Unlock()
		defer close(channel)

		for _, sel := range sel {
			e.selectors[sel.GetID()] = sel

			for _, ent := range e.entities {
				channelResult := e.handleEntitySelectorPair(ent, sel)
				if channelResult != nil {
					channel <- *channelResult
				}
			}
		}
	}()

	return channel
}

func (e *Exhaustive[E, S]) RemoveSelector(ctx context.Context, sel ...S) <-chan selector.ChannelResult[E, S] {
	channel := make(chan selector.ChannelResult[E, S])

	go func() {
		e.mu.Lock()
		defer e.mu.Unlock()
		defer close(channel)

		for _, sel := range sel {
			delete(e.selectors, sel.GetID())

			for _, ent := range e.entities {
				wasPreviouslyMatched := e.matches[ent.GetID()][sel.GetID()]
				if wasPreviouslyMatched {
					channel <- selector.ChannelResult[E, S]{
						MatchChange: &selector.MatchChange[E, S]{
							Entity:     ent,
							Selector:   sel,
							ChangeType: selector.MatchChangeTypeRemoved,
						},
					}
				}
				delete(e.matches[ent.GetID()], sel.GetID())
			}
		}
	}()

	return channel
}

func (e *Exhaustive[E, S]) GetSelectorsForEntity(ctx context.Context, entity E) ([]S, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	selectors := make([]S, 0)
	for _, sel := range e.selectors {
		if e.matches[entity.GetID()][sel.GetID()] {
			selectors = append(selectors, sel)
		}
	}

	return selectors, nil
}

func (e *Exhaustive[E, S]) GetEntitiesForSelector(ctx context.Context, sel S) ([]E, error) {
	e.mu.RLock()
	defer e.mu.RUnlock()

	entities := make([]E, 0)
	for _, ent := range e.entities {
		if e.matches[ent.GetID()][sel.GetID()] {
			entities = append(entities, ent)
		}
	}

	return entities, nil
}
