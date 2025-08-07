package engine

import (
	"workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/engine/selector/exhaustive"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type WorkspacePolicy struct {
}

type WorkspaceSelector struct {
	EnvironmentResources selector.SelectorEngine[resource.Resource, environment.Environment]
	DeploymentResources  selector.SelectorEngine[resource.Resource, deployment.Deployment]

	PolicyTargetResources    selector.SelectorEngine[resource.Resource, policy.PolicyTarget]
	PolicyTargetEnvironments selector.SelectorEngine[environment.Environment, policy.PolicyTarget]
	PolicyTargetDeployments  selector.SelectorEngine[deployment.Deployment, policy.PolicyTarget]

	PolicyTargetReleaseTargets selector.SelectorEngine[policy.ReleaseTarget, policy.PolicyTarget]
}

func NewWorkspaceEngine(workspaceID string) *WorkspaceEngine {
	return &WorkspaceEngine{
		WorkspaceID: workspaceID,
		Selectors: WorkspaceSelector{
			EnvironmentResources:       exhaustive.NewExhaustive[resource.Resource, environment.Environment](),
			DeploymentResources:        exhaustive.NewExhaustive[resource.Resource, deployment.Deployment](),
			PolicyTargetResources:      exhaustive.NewExhaustive[resource.Resource, policy.PolicyTarget](),
			PolicyTargetEnvironments:   exhaustive.NewExhaustive[environment.Environment, policy.PolicyTarget](),
			PolicyTargetDeployments:    exhaustive.NewExhaustive[deployment.Deployment, policy.PolicyTarget](),
			PolicyTargetReleaseTargets: exhaustive.NewExhaustive[policy.ReleaseTarget, policy.PolicyTarget](),
		},
	}
}

type WorkspaceEngine struct {
	WorkspaceID      string
	Selectors        WorkspaceSelector
	PolicyRepository policy.PolicyRepository[policy.ReleaseTarget]
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
