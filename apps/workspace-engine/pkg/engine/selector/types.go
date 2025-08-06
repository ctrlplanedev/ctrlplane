package selector

import (
	"context"
)

type Condition[E MatchableEntity] interface {
	Matches(entity E) (bool, error)
}

type MatchableEntity interface {
	GetID() string
}

type Selector[E MatchableEntity] interface {
	GetID() string
	GetConditions() Condition[E]
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

type BaseEntity[E MatchableEntity] struct {
	ID string
}

func (b BaseEntity[E]) GetID() string {
	return b.ID
}

type BaseSelector[E MatchableEntity] struct {
	ID         string
	Conditions Condition[MatchableEntity]
}

func (b BaseSelector[E]) GetID() string {
	return b.ID
}

func (b BaseSelector[E]) GetConditions() Condition[MatchableEntity]	 {
	return b.Conditions
}

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
