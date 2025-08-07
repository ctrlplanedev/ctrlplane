package selector

import (
	"context"
	"workspace-engine/pkg/model"
)

type MatchChange[E model.MatchableEntity, S model.SelectorEntity] struct {
	Entity     E
	Selector   S
	ChangeType MatchChangeType
}

type MatchChangeType string

const (
	MatchChangeTypeAdded   MatchChangeType = "added"
	MatchChangeTypeRemoved MatchChangeType = "removed"
)

type MatchChangesHandler[E model.MatchableEntity, S model.SelectorEntity] func(ctx context.Context, change MatchChange[E, S]) error

type ChannelResult[E model.MatchableEntity, S model.SelectorEntity] struct {
	MatchChange *MatchChange[E, S]
	Error       error
}

type SelectorEngine[E model.MatchableEntity, S model.SelectorEntity] interface {
	UpsertEntity(ctx context.Context, entity ...E) <-chan ChannelResult[E, S]
	RemoveEntity(ctx context.Context, entity ...E) <-chan ChannelResult[E, S]

	UpsertSelector(ctx context.Context, selector ...S) <-chan ChannelResult[E, S]
	RemoveSelector(ctx context.Context, selector ...S) <-chan ChannelResult[E, S]

	GetSelectorsForEntity(ctx context.Context, entity E) ([]S, error)
	GetEntitiesForSelector(ctx context.Context, selector S) ([]E, error)
}

func CollectMatchChangesByType[E model.MatchableEntity, S model.SelectorEntity](results <-chan ChannelResult[E, S]) ([]MatchChange[E, S], []MatchChange[E, S], error) {

	added := make([]MatchChange[E, S], 0)
	removed := make([]MatchChange[E, S], 0)

	for result := range results {
		if result.Error != nil {
			return nil, nil, result.Error
		}
		if result.MatchChange != nil {
			if result.MatchChange.ChangeType == MatchChangeTypeAdded {
				added = append(added, *result.MatchChange)
			}
			if result.MatchChange.ChangeType == MatchChangeTypeRemoved {
				removed = append(removed, *result.MatchChange)
			}
		}
	}

	return added, removed, nil
}
func CollectMatchedEntitiesFromChannel[E model.MatchableEntity, S model.SelectorEntity](r <-chan ChannelResult[E, S]) ([]E, error) {
	items := make([]E, 0)
	for result := range r {
		if result.Error != nil {
			return items, result.Error
		}
		if result.MatchChange != nil {
			items = append(items, result.MatchChange.Entity)
		}
	}
	return items, nil
}
