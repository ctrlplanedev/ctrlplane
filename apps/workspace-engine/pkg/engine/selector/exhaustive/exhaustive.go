package exhaustive

import (
	"context"
	"sync"
	"workspace-engine/pkg/engine/selector"
)

// Exhaustive implements the SelectorEngine interface
type Exhaustive[E selector.MatchableEntity, S selector.SelectorEntity] struct {
	// Storage for entities and selectors
	entities  map[string]E
	selectors map[string]selector.Selector[E]

	// Track current matches between entities and selectors
	matches map[string]map[string]bool // matches[entityID][selectorID] = isMatched

	// Mutex for thread safety
	mu sync.RWMutex
}

// NewExhaustive creates a new exhaustive instance
func NewExhaustive[E selector.MatchableEntity, S selector.SelectorEntity]() *Exhaustive[E, S] {
	return &Exhaustive[E, S]{
		entities:  make(map[string]E),
		selectors: make(map[string]selector.Selector[E]),
		matches:   make(map[string]map[string]bool),
	}
}

func (e *Exhaustive[E, S]) getMatchChangeType(matchResult bool) selector.MatchChangeType {
	if matchResult {
		return selector.MatchChangeTypeAdded
	}
	return selector.MatchChangeTypeRemoved
}

func (e *Exhaustive[E, S]) UpsertEntity(ctx context.Context, entity ...E) <-chan selector.ChannelResult[E, S] {
	e.mu.Lock()
	defer e.mu.Unlock()

	channel := make(chan selector.ChannelResult[E, S])

	go func() {
		defer close(channel)
		for _, ent := range entity {

			e.entities[ent.GetID()] = ent
			if e.matches[ent.GetID()] == nil {
				e.matches[ent.GetID()] = make(map[string]bool)
			}

			for _, sel := range e.selectors {
				wasPreviouslyMatched := e.matches[ent.GetID()][sel.GetID()]
				matchResult, err := sel.Matches(ent)
				if err != nil {
					channel <- selector.ChannelResult[E, S]{Error: err}
					continue
				}

				if matchResult != wasPreviouslyMatched {
					channel <- selector.ChannelResult[E, S]{
						MatchChange: &selector.MatchChange[E, S]{
							Entity:     ent,
							Selector:   sel.(S),
							ChangeType: e.getMatchChangeType(matchResult),
						},
					}
				}
			}
		}
	}()

	return channel
}

func (e *Exhaustive[E, S]) RemoveEntity(ctx context.Context, entity ...E) <-chan selector.ChannelResult[E, S] {
	e.mu.Lock()
	defer e.mu.Unlock()

	channel := make(chan selector.ChannelResult[E, S])

	go func() {
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
						Selector:   sel.(S),
						ChangeType: selector.MatchChangeTypeRemoved,
					},
				}
			}
		}
	}()

	return channel
}

func (e *Exhaustive[E, S]) UpsertSelector(ctx context.Context, sel ...S) <-chan selector.ChannelResult[E, S] {
	e.mu.Lock()
	defer e.mu.Unlock()

	channel := make(chan selector.ChannelResult[E, S])

	go func() {
		defer close(channel)

		for _, sel := range sel {
			selector, ok := sel.(selector.Selector[E])
			e.selectors[sel.GetID()] = sel

			for _, ent := range e.entities {
				matchResult, err := sel.Matches(ent)
				if err != nil {
					channel <- selector.ChannelResult[E, S]{Error: err}
					continue
				}

				e.matches[ent.GetID()][sel.GetID()] = matchResult
				channel <- selector.ChannelResult[E, S]{
					MatchChange: &selector.MatchChange[E, S]{
						Entity:     ent,
						Selector:   sel.(S),
						ChangeType: e.getMatchChangeType(matchResult),
					},
				}
			}
		}
	}()

	return channel
}

func (e *Exhaustive[E, S]) RemoveSelector(ctx context.Context, sel ...S) <-chan selector.ChannelResult[E, S] {
	e.mu.Lock()
	defer e.mu.Unlock()

	channel := make(chan selector.ChannelResult[E, S])

	go func() {
		defer close(channel)

		for _, sel := range sel {
			delete(e.selectors, sel.GetID())

			for _, ent := range e.entities {
				wasPreviouslyMatched := e.matches[ent.GetID()][sel.GetID()]
				if !wasPreviouslyMatched {
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
			selectors = append(selectors, sel.(S))
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
