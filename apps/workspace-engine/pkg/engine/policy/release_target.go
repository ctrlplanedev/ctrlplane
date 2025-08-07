package policy

import (
	"fmt"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/conditions"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type ReleaseTarget struct {
	Resource    resource.Resource
	Environment environment.Environment
	Deployment  deployment.Deployment
}

func (r ReleaseTarget) GetID() string {
	return r.Resource.ID + r.Deployment.ID + r.Environment.ID
}

func (r ReleaseTarget) GetType() string {
	return "release_target"
}

type PolicyTarget struct {
	ID string

	ResourceSelector    conditions.JSONCondition `json:"resourceSelector"`
	EnvironmentSelector conditions.JSONCondition `json:"environmentSelector"`
	DeploymentSelector  conditions.JSONCondition `json:"deploymentSelector"`

	EnvironmentMatcher selector.SelectorEngine[environment.Environment, PolicyTarget]
	DeploymentMatcher  selector.SelectorEngine[deployment.Deployment, PolicyTarget]
	ResourceMatcher    selector.SelectorEngine[resource.Resource, PolicyTarget]
}

func (p PolicyTarget) GetID() string {
	return p.ID
}

func (p PolicyTarget) Selector(entity model.MatchableEntity) (conditions.JSONCondition, error) {
	if _, ok := entity.(resource.Resource); ok {
		return p.ResourceSelector, nil
	}
	if _, ok := entity.(environment.Environment); ok {
		return p.EnvironmentSelector, nil
	}
	if _, ok := entity.(deployment.Deployment); ok {
		return p.DeploymentSelector, nil
	}

	return conditions.JSONCondition{}, fmt.Errorf("entity type is not supported by policy target selector")
}
