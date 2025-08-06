package selector

import (
	"context"
)

type MatchableEntity interface {
	GetID() string
}

type SelectorEntity interface {
	GetID() string
}

type Selector[E MatchableEntity] interface {
	GetID() string
	Matches(entity E) (bool, error)
}

type MatchChange[E MatchableEntity, S SelectorEntity] struct {
	Entity     E
	Selector   S
	ChangeType MatchChangeType
}

type MatchChangeType string

const (
	MatchChangeTypeAdded   MatchChangeType = "added"
	MatchChangeTypeRemoved MatchChangeType = "removed"
)

type MatchChangesHandler[E MatchableEntity, S SelectorEntity] func(ctx context.Context, change MatchChange[E, S]) error

type ChannelResult[E MatchableEntity, S SelectorEntity] struct {
	MatchChange *MatchChange[E, S]

	Done  bool
	Error error
}

type SelectorEngine[E MatchableEntity, S SelectorEntity] interface {
	UpsertEntity(ctx context.Context, entity ...E) <-chan ChannelResult[E, S]
	RemoveEntity(ctx context.Context, entity ...E) <-chan ChannelResult[E, S]

	UpsertSelector(ctx context.Context, selector ...S) <-chan ChannelResult[E, S]
	RemoveSelector(ctx context.Context, selector ...S) <-chan ChannelResult[E, S]

	GetSelectorsForEntity(ctx context.Context, entity E) ([]S, error)
	GetEntitiesForSelector(ctx context.Context, selector S) ([]E, error)
}
