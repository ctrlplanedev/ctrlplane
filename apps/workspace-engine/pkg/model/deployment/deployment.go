package deployment

import (
	"fmt"
	"workspace-engine/pkg/engine/selector"
)

type Deployment struct {
	ID string
}

func (d Deployment) GetID() string {
	return d.ID
}

func (d Deployment) GetMatchableEntity(entityType selector.MatchableEntityType) (selector.MatchableEntity, error) {
	if entityType == selector.MatchableEntityDefault {
		return d, nil
	}
	return nil, fmt.Errorf("unsupported entity type: %s", entityType)
}

func (d Deployment) GetConditions() selector.Condition {
	return nil
}
