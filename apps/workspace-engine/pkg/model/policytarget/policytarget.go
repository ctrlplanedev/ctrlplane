package policytarget

import "workspace-engine/pkg/model/conditions"

type Policy struct {
	ID string `json:"id"`

	Name string `json:"name"`
}

func (p Policy) GetID() string {
	return p.ID
}

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
