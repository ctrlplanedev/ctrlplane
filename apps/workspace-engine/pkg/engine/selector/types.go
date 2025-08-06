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

type BaseEntity struct {
	ID string
}

func (b BaseEntity) GetID() string {
	return b.ID
}

type BaseSelector struct {
	ID         string
	Conditions Condition[MatchableEntity]
}

func (b BaseSelector) GetID() string {
	return b.ID
}

func (b BaseSelector) GetConditions() Condition[MatchableEntity]	 {
	return b.Conditions
}

type MatchChangesHandler[E MatchableEntity] func(ctx context.Context, change MatchChange[E]) error

type ChannelResult struct {
	MatchChange *MatchChange[MatchableEntity]

	Done  bool
	Error error
}

type SelectorEngine[E MatchableEntity, S Selector[E]] interface {
	UpsertEntity(ctx context.Context, entity ...E) <-chan ChannelResult
	RemoveEntity(ctx context.Context, entity ...E) <-chan ChannelResult

	UpsertSelector(ctx context.Context, selector ...S) <-chan ChannelResult
	RemoveSelector(ctx context.Context, selector ...S) <-chan ChannelResult

	GetSelectorsForEntity(ctx context.Context, entity E) ([]S, error)
	GetEntitiesForSelector(ctx context.Context, selector S) ([]E, error)
}
