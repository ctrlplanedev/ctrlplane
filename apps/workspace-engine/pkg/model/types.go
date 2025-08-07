package model

import "workspace-engine/pkg/model/conditions"

type MatchableEntity interface {
	GetID() string
}

type SelectorEntity interface {
	GetID() string
	Selector(entity MatchableEntity) (conditions.JSONCondition, error)
}
