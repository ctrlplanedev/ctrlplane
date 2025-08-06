package engine

import (
	"workspace-engine/pkg/engine/selector"
)

type Environment struct {
	ID string
	Conditions selector.Condition
}

func (e Environment) GetID() string {
	return e.ID
}

func (e Environment) GetConditions() selector.Condition {
	return e.Conditions
}

type ReleaseTarget struct {
	EnvironmentID string
	ResourceID    string
	DeploymentID  string
}

func NewWorkspaceStore(workspaceID string) *WorkspaceStore {
	workspaceSelector := &WorkspaceSelector{}
	workspaceSelector.ReleaseTargets = make([]ReleaseTarget, 0)


	return &WorkspaceStore{
		WorkspaceID: workspaceID,
	}
}

type WorkspaceSelector struct {
	EnvironmentResources selector.SelectorEngine[selector.BaseEntity, selector.BaseSelector]
	DeploymentResources  selector.SelectorEngine[selector.BaseEntity, selector.BaseSelector]

	ReleaseTargets []ReleaseTarget
}

type WorkspaceStore struct {
	WorkspaceID string
}




