package environment

import (
	"fmt"
	"time"
	"workspace-engine/pkg/model"
	"workspace-engine/pkg/model/conditions"
	"workspace-engine/pkg/model/resource"
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

func (e Environment) Selector(entity model.MatchableEntity) (conditions.JSONCondition, error) {
	if _, ok := entity.(resource.Resource); ok {
		return e.ResourceSelector, nil
	}
	return conditions.JSONCondition{}, fmt.Errorf("entity is not a supported selector option")
}
