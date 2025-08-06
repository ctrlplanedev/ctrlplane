package environment

import (
	"fmt"
	"time"
	"workspace-engine/pkg/engine/selector"
)

type Environment struct {
	ID        string
	Name      string
	SystemID  string
	CreatedAt time.Time
}

func (e Environment) GetID() string {
	return e.ID
}

func (e Environment) GetMatchableEntity(entityType selector.MatchableEntityType) (selector.MatchableEntity, error) {
	if entityType == selector.MatchableEntityDefault {
		return e, nil
	}
	return nil, fmt.Errorf("unsupported entity type: %s", entityType)
}

func (e Environment) GetConditions() selector.Condition {
	return nil
}
