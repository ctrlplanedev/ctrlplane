package resource

import (
	"fmt"
	"time"
	"workspace-engine/pkg/engine/selector"
)

type Resource struct {
	ID          string            `json:"id"`
	WorkspaceID string            `json:"workspaceId"`
	Identifier  string            `json:"identifier"`
	Name        string            `json:"name"`
	Kind        string            `json:"kind"`
	Version     string            `json:"version"`
	CreatedAt   time.Time         `json:"createdAt"`
	Metadata    map[string]string `json:"metadata"`
}

func (r Resource) GetID() string {
	return r.ID
}

func (r Resource) GetMatchableEntity(entityType selector.MatchableEntityType) (selector.MatchableEntity, error) {
	if entityType == selector.MatchableEntityDefault {
		return r, nil
	}
	return nil, fmt.Errorf("unsupported entity type: %s", entityType)
}
