package policytarget

import "workspace-engine/pkg/model/conditions"

type PolicyTarget struct {
	ID string `json:"id"`

	DeploymentSelector  conditions.JSONCondition `json:"deploymentSelector"`
	EnvironmentSelector conditions.JSONCondition `json:"environmentSelector"`
	ResourceSelector    conditions.JSONCondition `json:"resourceSelector"`
}

func (p PolicyTarget) GetID() string {
	return p.ID
}
