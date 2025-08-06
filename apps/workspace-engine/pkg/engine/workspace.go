package engine

import (
	"workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/resource"
)

func NewWorkspaceStore(WorkspaceID string) *WorkspaceStore {
	return &WorkspaceStore{WorkspaceID}
}

func (w *WorkspaceStore) GetWorkspaceID() string {
	return w.WorkspaceID
}

type WorkspaceSelector struct {
	EnvironmentResources selector.SelectorEngine[resource.Resource]
	DeploymentResources  selector.SelectorEngine[resource.Resource]

	PolicyTargetResources    selector.SelectorEngine[resource.Resource]
	PolicyTargetEnvironments selector.SelectorEngine[resource.Resource]
	PolicyTargetDeployments  selector.SelectorEngine[resource.Resource]

	PolicyTargetReleaseTargets selector.SelectorEngine[policy.ReleaseTarget]
}

type WorkspaceStore struct {
	WorkspaceID string
}




