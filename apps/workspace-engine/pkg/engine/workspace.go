package engine

import (
	"workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

func NewWorkspaceStore(WorkspaceID string) *WorkspaceStore {
	return &WorkspaceStore{WorkspaceID}
}

func (w *WorkspaceStore) GetWorkspaceID() string {
	return w.WorkspaceID
}

type WorkspaceSelector struct {
	EnvironmentResources selector.SelectorEngine[resource.Resource, environment.Environment]
	DeploymentResources  selector.SelectorEngine[resource.Resource, deployment.Deployment]

	PolicyTargetReleaseTargets selector.SelectorEngine[policy.ReleaseTarget, policy.PolicyTarget]
}

type WorkspaceStore struct {
	WorkspaceID string
}
