package environment

import (
	"fmt"
	"time"
	"workspace-engine/pkg/model"
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

func (e Environment) Selector(entity model.MatchableEntity) (conditions.JSONCondition, error) {
	if entity.GetType() != "resource" {
		return conditions.JSONCondition{}, fmt.Errorf("entity type %s is not supported by environment selector", entity.GetType())
	}

	return e.ResourceSelector, nil
}

func (e Environment) GetType() string {
	return "environment"
}
