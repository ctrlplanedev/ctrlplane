package deployment

import (
	"fmt"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/conditions"
	"workspace-engine/pkg/model/resource"
)

type Deployment struct {
	ID string `json:"id"`

	SystemID string `json:"systemId"`

	ResourceSelector conditions.JSONCondition `json:"resourceSelector"`
}

func (d Deployment) GetID() string {
	return d.ID
}

func (d Deployment) Selector(entity model.MatchableEntity) (conditions.JSONCondition, error) {
	if _, ok := entity.(resource.Resource); ok {
		return d.ResourceSelector, nil
	}
	return conditions.JSONCondition{}, fmt.Errorf("entity is not a supported selector option")
}

type DeploymentVersion struct {
	ID           string `json:"id"`
	DeploymentID string `json:"deploymentId"`
	Tag          string `json:"tag"`
}