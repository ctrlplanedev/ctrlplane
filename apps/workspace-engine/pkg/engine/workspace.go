package engine

import (
	epolicy "workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/engine/selector/exhaustive"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/policy"
	"workspace-engine/pkg/model/resource"

	"github.com/charmbracelet/log"
)

type WorkspaceRepository struct {
	ReleaseTarget *epolicy.ReleaseTargetRepository
	Policy        epolicy.Repository[epolicy.Policy]
}

type WorkspaceSelector struct {
	EnvironmentResources selector.SelectorEngine[resource.Resource, environment.Environment]
	DeploymentResources  selector.SelectorEngine[resource.Resource, deployment.Deployment]

	PolicyTargetResources    selector.SelectorEngine[resource.Resource, policy.PolicyTarget]
	PolicyTargetEnvironments selector.SelectorEngine[environment.Environment, policy.PolicyTarget]
	PolicyTargetDeployments  selector.SelectorEngine[deployment.Deployment, policy.PolicyTarget]
}

func NewWorkspaceEngine(workspaceID string) *WorkspaceEngine {
	selectors := WorkspaceSelector{
		EnvironmentResources:     exhaustive.NewExhaustive[resource.Resource, environment.Environment](),
		DeploymentResources:      exhaustive.NewExhaustive[resource.Resource, deployment.Deployment](),
		PolicyTargetResources:    exhaustive.NewExhaustive[resource.Resource, policy.PolicyTarget](),
		PolicyTargetEnvironments: exhaustive.NewExhaustive[environment.Environment, policy.PolicyTarget](),
		PolicyTargetDeployments:  exhaustive.NewExhaustive[deployment.Deployment, policy.PolicyTarget](),
	}
	repository := WorkspaceRepository{
		ReleaseTarget: epolicy.NewReleaseTargetRepository(),
		Policy:        epolicy.NewPolicyRepository(),
	}
	return &WorkspaceEngine{
		WorkspaceID: workspaceID,
		Selectors:   selectors,
		Repository:  repository,
	}
}

type WorkspaceEngine struct {
	WorkspaceID string
	Selectors   WorkspaceSelector
	Repository  WorkspaceRepository
}

var workspaces = make(map[string]*WorkspaceEngine)

func GetWorkspaceEngine(workspaceID string) *WorkspaceEngine {
	engine, ok := workspaces[workspaceID]
	if !ok {
		engine = NewWorkspaceEngine(workspaceID)
		log.Warn("Creating new workspace engine.", "workspaceID", workspaceID)
		workspaces[workspaceID] = engine
	}
	return engine
}
