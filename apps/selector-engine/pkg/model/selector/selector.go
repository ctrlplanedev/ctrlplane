package selector

type EntityType string

const (
	DeploymentEntityType  EntityType = "deployment"
	EnvironmentEntityType EntityType = "environment"
)

var AllEntityTypes = []EntityType{DeploymentEntityType, EnvironmentEntityType}

type ResourceSelector struct {
	ID          string     `json:"id"`
	WorkspaceID string     `json:"workspace_id"`
	EntityType  EntityType `json:"entity_type"`
	Condition   Condition  `json:"selector"`
}

type ResourceSelectorRef struct {
	ID          string     `json:"id"`
	WorkspaceID string     `json:"workspace_id"`
	EntityType  EntityType `json:"entity_type"`
}
