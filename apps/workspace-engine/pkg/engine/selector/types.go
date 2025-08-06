package selector

import (
	"context"
)

type MatchableEntity interface {
	GetID() string
}

type Selector[E MatchableEntity] interface {
	GetID() string
	Matches(entity E) (bool, error)
}

type MatchChange[E MatchableEntity] struct {
	Entity     E
	Selector   Selector[E]
	ChangeType MatchChangeType
}

type MatchChangeType string

const (
	MatchChangeTypeAdded   MatchChangeType = "added"
	MatchChangeTypeRemoved MatchChangeType = "removed"
)

type MatchChangesHandler[E MatchableEntity] func(ctx context.Context, change MatchChange[E]) error

type ChannelResult[E MatchableEntity] struct {
	MatchChange *MatchChange[E]

	Done  bool
	Error error
}

type SelectorEngine[E MatchableEntity] interface {
	UpsertEntity(ctx context.Context, entity ...E) <-chan ChannelResult[E]
	RemoveEntity(ctx context.Context, entity ...E) <-chan ChannelResult[E]

	UpsertSelector(ctx context.Context, selector ...Selector[E]) <-chan ChannelResult[E]
	RemoveSelector(ctx context.Context, selector ...Selector[E]) <-chan ChannelResult[E]

	GetSelectorsForEntity(ctx context.Context, entity E) ([]Selector[E], error)
	GetEntitiesForSelector(ctx context.Context, selector Selector[E]) ([]E, error)
}
