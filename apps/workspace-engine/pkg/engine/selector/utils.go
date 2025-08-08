package selector

import "workspace-engine/pkg/model"

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

type Change[E any] struct {
	Added   []E
	Removed []E
}

func NewEntityChange[E model.MatchableEntity, S model.SelectorEntity](results <-chan ChannelResult[E, S]) Change[E] {
	added := make([]E, 0)
	removed := make([]E, 0)

	for result := range results {
		if result.MatchChange != nil {
			if result.MatchChange.ChangeType == MatchChangeTypeAdded {
				added = append(added, result.MatchChange.Entity)
			}
			if result.MatchChange.ChangeType == MatchChangeTypeRemoved {
				removed = append(removed, result.MatchChange.Entity)
			}
		}
	}

	return Change[E]{
		Added:   added,
		Removed: removed,
	}
}

func NewSelectorChange[E model.MatchableEntity, S model.SelectorEntity](results <-chan ChannelResult[E, S]) Change[S] {
	added := make([]S, 0)
	removed := make([]S, 0)

	for result := range results {
		if result.MatchChange != nil {
			if result.MatchChange.ChangeType == MatchChangeTypeAdded {
				added = append(added, result.MatchChange.Selector)
			}
			if result.MatchChange.ChangeType == MatchChangeTypeRemoved {
				removed = append(removed, result.MatchChange.Selector)
			}
		}
	}

	return Change[S]{
		Added:   added,
		Removed: removed,
	}
}
