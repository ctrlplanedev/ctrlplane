package engine

import (
	"workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type WorkspaceSelector struct {
	EnvironmentResources selector.SelectorEngine[resource.Resource, environment.Environment]
	DeploymentResources  selector.SelectorEngine[resource.Resource, deployment.Deployment]

	PolicyTargetResources    selector.SelectorEngine[resource.Resource, policy.ReleaseTarget]
	PolicyTargetEnvironments selector.SelectorEngine[environment.Environment, policy.ReleaseTarget]
	PolicyTargetDeployments  selector.SelectorEngine[deployment.Deployment, policy.ReleaseTarget]

	PolicyTargetReleaseTargets selector.SelectorEngine[policy.ReleaseTarget, policy.ReleaseTarget]
}
	
func NewWorkspaceEngine(workspaceID string) *WorkspaceEngine {
	return &WorkspaceEngine{
		WorkspaceID: workspaceID,
	}	
}

type WorkspaceEngine struct {
	WorkspaceID string
	Selectors   WorkspaceSelector
}

var workspaces = make(map[string]*WorkspaceEngine)

func GetWorkspaceEngine(workspaceID string) *WorkspaceEngine {
	engine, ok := workspaces[workspaceID]
	if !ok {
		engine = NewWorkspaceEngine(workspaceID)
		workspaces[workspaceID] = engine
	}
	return engine
}
