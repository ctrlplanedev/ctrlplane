package model

import (
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type EnvironmentResourceSelector struct {
	Environment environment.Environment
}

func (b EnvironmentResourceSelector) GetID() string {
	return b.Environment.ID
}

func (b EnvironmentResourceSelector) Matches(entity resource.Resource) (bool, error) {
	return true, nil
}
