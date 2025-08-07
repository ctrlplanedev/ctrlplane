package deployment

import (
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
