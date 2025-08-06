package model

import (
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type EnvironmentResourceSelector struct {
	Environment environment.Environment
	Conditions  selector.Condition[resource.Resource]
}

func (b EnvironmentResourceSelector) GetID() string {
	return b.Environment.ID
}

func (b EnvironmentResourceSelector) GetConditions() selector.Condition[resource.Resource] {
	return b.Conditions
}
