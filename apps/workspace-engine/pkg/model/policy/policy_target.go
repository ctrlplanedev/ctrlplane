package policy

import (
	"fmt"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/conditions"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type PolicyTarget struct {
	ID string `json:"id"`

	PolicyID string `json:"policyId"`

	DeploymentSelector  conditions.JSONCondition `json:"deploymentSelector"`
	EnvironmentSelector conditions.JSONCondition `json:"environmentSelector"`
	ResourceSelector    conditions.JSONCondition `json:"resourceSelector"`
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

	return conditions.JSONCondition{}, fmt.Errorf("entity is not a supported selector option")
}