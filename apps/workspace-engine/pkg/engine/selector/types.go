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

	GetAllEntities(ctx context.Context) ([]E, error)
	GetAllSelectors(ctx context.Context) ([]S, error)
}
