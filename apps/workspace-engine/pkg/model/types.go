package model

import "workspace-engine/pkg/model/conditions"

type Entity interface {
	GetID() string
}

func CreateMap[T Entity](entities []T) map[string]T {
	entityMap := make(map[string]T)
	for _, entity := range entities {
		entityMap[entity.GetID()] = entity
	}
	return entityMap
}

type MatchableEntity = Entity

type SelectorEntity interface {
	Entity
	MatchAllIfNullSelector(entity MatchableEntity) bool
	Selector(entity MatchableEntity) (*conditions.JSONCondition, error)
}
