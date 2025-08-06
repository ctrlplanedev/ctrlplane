package selector

import (
	"context"
	"fmt"
)

type Condition interface {
	Matches(entity MatchableEntity) (bool, error)
}

type MatchableEntityType string

const (
	MatchableEntityDefault     MatchableEntityType = "" // Default entity type is to use the MatchableEntity provided
	MatchableEntityResource    MatchableEntityType = "resource"
	MatchableEntityDeployment  MatchableEntityType = "deployment"
	MatchableEntityEnvironment MatchableEntityType = "environment"
)

type MatchableEntity interface {
	GetID() string
	GetMatchableEntity(entityType MatchableEntityType) (MatchableEntity, error)
}

type Selector interface {
	GetID() string
	GetConditions() Condition
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

type BaseEntity struct {
	ID string
}

func (b BaseEntity) GetID() string {
	return b.ID
}

func (b BaseEntity) GetMatchableEntity(entityType MatchableEntityType) (MatchableEntity, error) {
	if entityType == MatchableEntityDefault {
		return b, nil
	}
	return nil, fmt.Errorf("unsupported entity type: %s", entityType)
}

type BaseSelector struct {
	ID         string
	Conditions Condition
}

func (b BaseSelector) GetID() string {
	return b.ID
}

func (b BaseSelector) GetConditions() Condition {
	return b.Conditions
}

type MatchChangesHandler func(ctx context.Context, change MatchChange) error

type ChannelResult struct {
	MatchChange *MatchChange

	Done  bool
	Error error
}

type SelectorEngine[E MatchableEntity, S Selector] interface {
	UpsertEntity(ctx context.Context, entity ...E) <-chan ChannelResult
	RemoveEntity(ctx context.Context, entity ...E) <-chan ChannelResult

	UpsertSelector(ctx context.Context, selector ...S) <-chan ChannelResult
	RemoveSelector(ctx context.Context, selector ...S) <-chan ChannelResult

	GetSelectorsForEntity(ctx context.Context, entity E) ([]S, error)
	GetEntitiesForSelector(ctx context.Context, selector S) ([]E, error)
}
