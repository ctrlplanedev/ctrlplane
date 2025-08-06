package deployment

import (
	"workspace-engine/pkg/model/conditions"
)

type Deployment struct {
	ID string

	ResourceSelector conditions.JSONCondition `json:"resourceSelector"`
}

func (d Deployment) GetID() string {
	return d.ID
}
