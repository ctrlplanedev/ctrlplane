package engine

import (
	"workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/resource"
)

func NewWorkspaceStore(workspaceID string) *WorkspaceStore {
	return &WorkspaceStore{
		WorkspaceID: workspaceID,
	}
}

type WorkspaceSelector struct {
	EnvironmentResources selector.SelectorEngine[selector.BaseEntity, selector.BaseSelector]
	DeploymentResources  selector.SelectorEngine[selector.BaseEntity, selector.BaseSelector]

	PolicyTargets selector.SelectorEngine[resource.Resource, policy.PolicyTarget]
}

type WorkspaceStore struct {
	WorkspaceID string
}




