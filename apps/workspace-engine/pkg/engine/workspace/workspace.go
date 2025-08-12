package workspace

import (
	"context"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type WorkspaceEngine struct {
	WorkspaceID string

	SelectorManager      *SelectorManager
	ReleaseTargetManager *ReleaseTargetManager
	Repository           *WorkspaceRepository
	PolicyManager        *PolicyManager
	JobDispatcher        *JobDispatcher
}

func NewWorkspaceEngine(workspaceID string) *WorkspaceEngine {
	repository := NewWorkspaceRepository()
	selectorManager := NewSelectorManager()
	releaseTargetManager := NewReleaseTargetManager(selectorManager, repository)
	policyManager := NewPolicyManager(repository)

	return &WorkspaceEngine{
		WorkspaceID:          workspaceID,
		SelectorManager:      selectorManager,
		ReleaseTargetManager: releaseTargetManager,
		PolicyManager:        policyManager,
		Repository:           repository,
	}
}

func (e *WorkspaceEngine) UpsertResource(ctx context.Context, resources ...resource.Resource) *FluentPipeline {
	return &FluentPipeline{
		engine:    e,
		operation: OperationUpdate,
		resources: resources,
	}
}

func (e *WorkspaceEngine) RemoveResource(ctx context.Context, resources ...resource.Resource) *FluentPipeline {
	return &FluentPipeline{
		engine:    e,
		operation: OperationRemove,
		resources: resources,
	}
}

func (e *WorkspaceEngine) UpsertEnvironment(ctx context.Context, environments ...environment.Environment) *FluentPipeline {
	return &FluentPipeline{
		engine:       e,
		operation:    OperationUpdate,
		environments: environments,
	}
}

func (e *WorkspaceEngine) RemoveEnvironment(ctx context.Context, environments ...environment.Environment) *FluentPipeline {
	return &FluentPipeline{
		engine:       e,
		operation:    OperationRemove,
		environments: environments,
	}
}

func (e *WorkspaceEngine) UpsertDeployment(ctx context.Context, deployments ...deployment.Deployment) *FluentPipeline {
	return &FluentPipeline{
		engine:      e,
		operation:   OperationUpdate,
		deployments: deployments,
	}
}

func (e *WorkspaceEngine) RemoveDeployment(ctx context.Context, deployments ...deployment.Deployment) *FluentPipeline {
	return &FluentPipeline{
		engine:      e,
		operation:   OperationRemove,
		deployments: deployments,
	}
}

func (e *WorkspaceEngine) UpsertDeploymentVersion(ctx context.Context, deploymentVersions ...deployment.DeploymentVersion) *FluentPipeline {
	fp := &FluentPipeline{
		engine:             e,
		operation:          OperationUpdate,
		deploymentVersions: deploymentVersions,
	}
	return fp.UpdateDeploymentVersions()
}

func (e *WorkspaceEngine) RemoveDeploymentVersion(ctx context.Context, deploymentVersions ...deployment.DeploymentVersion) *FluentPipeline {
	fp := &FluentPipeline{
		engine:             e,
		operation:          OperationRemove,
		deploymentVersions: deploymentVersions,
	}
	return fp.UpdateDeploymentVersions()
}
