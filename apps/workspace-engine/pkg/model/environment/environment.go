package environment

import (
	"time"
	"workspace-engine/pkg/model/conditions"
)

type Environment struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	SystemID  string    `json:"systemId"`
	CreatedAt time.Time `json:"createdAt"`

	ResourceSelector conditions.JSONCondition `json:"resourceSelector"`
}

func (e Environment) GetID() string {
	return e.ID
}
