package deployment

import (
	"fmt"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/conditions"
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
	if entity.GetType() != "resource" {
		return conditions.JSONCondition{}, fmt.Errorf("entity type %s is not supported by deployment selector", entity.GetType())
	}

	return d.ResourceSelector, nil
}

func (d Deployment) GetType() string {
	return "deployment"
}
