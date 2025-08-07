package exhaustive

import (
	"context"
	"sync"
	"workspace-engine/pkg/engine/selector"
)

// Exhaustive implements the SelectorEngine interface
type Exhaustive struct {
	// Storage for entities and selectors
	entities  map[string]selector.MatchableEntity
	selectors map[string]selector.Selector[selector.MatchableEntity]

	// Track current matches between entities and selectors
	matches map[string]map[string]bool // matches[entityID][selectorID] = isMatched

	// Mutex for thread safety
	mu sync.RWMutex
}

// NewExhaustive creates a new exhaustive instance
func NewExhaustive() *Exhaustive {
	return &Exhaustive{
		entities:  make(map[string]selector.MatchableEntity),
		selectors: make(map[string]selector.Selector[selector.MatchableEntity]),
		matches:   make(map[string]map[string]bool),
	}
}

func (e *Exhaustive) getMatchChangeType(matchResult bool) selector.MatchChangeType {
	if matchResult {
		return selector.MatchChangeTypeAdded
	}
	return selector.MatchChangeTypeRemoved
}

func (e *Exhaustive) UpsertEntity(ctx context.Context, entity ...selector.MatchableEntity) <-chan selector.ChannelResult[selector.MatchableEntity, selector.Selector[selector.MatchableEntity]] {
	e.mu.Lock()
	defer e.mu.Unlock()

	channel := make(chan selector.ChannelResult[selector.MatchableEntity, selector.Selector[selector.MatchableEntity]])

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
					channel <- selector.ChannelResult[selector.MatchableEntity, selector.Selector[selector.MatchableEntity]]{Error: err}
				}

				if matchResult != wasPreviouslyMatched {
					channel <- selector.ChannelResult[selector.MatchableEntity, selector.Selector[selector.MatchableEntity]]{
						MatchChange: &selector.MatchChange[selector.MatchableEntity, selector.Selector[selector.MatchableEntity]]{
							Entity:     ent,
							Selector:   sel,
							ChangeType: e.getMatchChangeType(matchResult),
						},
					}
				}
			}
		}
	}()

	return channel
}
