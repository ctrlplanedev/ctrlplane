package selector

import (
	"context"
	"workspace-engine/pkg/model/selector"
)

type MatchableEntity interface {
	GetID() string
	GetWorkspaceID() string
}

type Selector interface {
	GetID() string
	GetWorkspaceID() string
	Conditions() []selector.Condition
}

type MatchChange struct {
	Entity     MatchableEntity
	Selector   Selector
	ChangeType MatchChangeType
}

type MatchChangeType string

const (
	MatchChangeTypeAdded   MatchChangeType = "added"
	MatchChangeTypeRemoved MatchChangeType = "removed"
)

type SelectorEngine[E MatchableEntity, S Selector] interface {
	LoadEntities(ctx context.Context, entities []E) error
	UpsertEntity(ctx context.Context, entity E) error
	RemoveEntities(ctx context.Context, entities []E) error
	RemoveEntity(ctx context.Context, entity E) error

	LoadSelectors(ctx context.Context, selectors []S) error
	UpsertSelector(ctx context.Context, selector S) error
	RemoveSelectors(ctx context.Context, selectors []S) error
	RemoveSelector(ctx context.Context, selector S) error

	OnMatchChange(cb func(ctx context.Context, change MatchChange) error) error
}
