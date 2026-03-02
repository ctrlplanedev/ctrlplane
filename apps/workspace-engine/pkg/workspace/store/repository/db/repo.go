package db

import (
	"context"
	"workspace-engine/pkg/workspace/store/repository"
	"workspace-engine/pkg/workspace/store/repository/db/deployments"
	"workspace-engine/pkg/workspace/store/repository/db/deploymentvariables"
	"workspace-engine/pkg/workspace/store/repository/db/deploymentversions"
	"workspace-engine/pkg/workspace/store/repository/db/environments"
	"workspace-engine/pkg/workspace/store/repository/db/jobagents"
	"workspace-engine/pkg/workspace/store/repository/db/jobs"
	"workspace-engine/pkg/workspace/store/repository/db/policies"
	"workspace-engine/pkg/workspace/store/repository/db/releases"
	"workspace-engine/pkg/workspace/store/repository/db/resourceproviders"
	"workspace-engine/pkg/workspace/store/repository/db/resources"
	"workspace-engine/pkg/workspace/store/repository/db/resourcevariables"
	"workspace-engine/pkg/workspace/store/repository/db/systemdeployments"
	"workspace-engine/pkg/workspace/store/repository/db/systemenvironments"
	"workspace-engine/pkg/workspace/store/repository/db/systems"
	"workspace-engine/pkg/workspace/store/repository/db/userapprovalrecords"
	"workspace-engine/pkg/workspace/store/repository/db/workflows"
)

type DBRepo struct {
	deploymentVersions       repository.DeploymentVersionRepo
	deployments              repository.DeploymentRepo
	environments             repository.EnvironmentRepo
	resources                repository.ResourceRepo
	systems                  repository.SystemRepo
	jobAgents                repository.JobAgentRepo
	jobs                     repository.JobRepo
	resourceProviders        repository.ResourceProviderRepo
	releases                 repository.ReleaseRepo
	systemDeployments        repository.SystemDeploymentRepo
	systemEnvironments       repository.SystemEnvironmentRepo
	policies                 repository.PolicyRepo
	userApprovalRecords      repository.UserApprovalRecordRepo
	resourceVariables        repository.ResourceVariableRepo
	deploymentVariables      repository.DeploymentVariableRepo
	deploymentVariableValues repository.DeploymentVariableValueRepo
	workflows                repository.WorkflowRepo
	workflowJobTemplates     repository.WorkflowJobTemplateRepo
	workflowRuns             repository.WorkflowRunRepo
	workflowJobs             repository.WorkflowJobRepo
}

func (d *DBRepo) DeploymentVersions() repository.DeploymentVersionRepo {
	return d.deploymentVersions
}

func (d *DBRepo) Deployments() repository.DeploymentRepo {
	return d.deployments
}

func (d *DBRepo) Environments() repository.EnvironmentRepo {
	return d.environments
}

func (d *DBRepo) Resources() repository.ResourceRepo {
	return d.resources
}

func (d *DBRepo) Systems() repository.SystemRepo {
	return d.systems
}

func (d *DBRepo) JobAgents() repository.JobAgentRepo {
	return d.jobAgents
}

func (d *DBRepo) Jobs() repository.JobRepo {
	return d.jobs
}

func (d *DBRepo) ResourceProviders() repository.ResourceProviderRepo {
	return d.resourceProviders
}

func (d *DBRepo) Releases() repository.ReleaseRepo {
	return d.releases
}

func (d *DBRepo) SystemDeployments() repository.SystemDeploymentRepo {
	return d.systemDeployments
}

func (d *DBRepo) SystemEnvironments() repository.SystemEnvironmentRepo {
	return d.systemEnvironments
}

func (d *DBRepo) Policies() repository.PolicyRepo {
	return d.policies
}

func (d *DBRepo) UserApprovalRecords() repository.UserApprovalRecordRepo {
	return d.userApprovalRecords
}

func (d *DBRepo) ResourceVariables() repository.ResourceVariableRepo {
	return d.resourceVariables
}

func (d *DBRepo) DeploymentVariables() repository.DeploymentVariableRepo {
	return d.deploymentVariables
}

func (d *DBRepo) DeploymentVariableValues() repository.DeploymentVariableValueRepo {
	return d.deploymentVariableValues
}

func (d *DBRepo) Workflows() repository.WorkflowRepo {
	return d.workflows
}

func (d *DBRepo) WorkflowJobTemplates() repository.WorkflowJobTemplateRepo {
	return d.workflowJobTemplates
}

func (d *DBRepo) WorkflowRuns() repository.WorkflowRunRepo {
	return d.workflowRuns
}

func (d *DBRepo) WorkflowJobs() repository.WorkflowJobRepo {
	return d.workflowJobs
}

func NewDBRepo(ctx context.Context, workspaceID string) *DBRepo {
	return &DBRepo{
		deploymentVersions:       deploymentversions.NewRepo(ctx, workspaceID),
		deployments:              deployments.NewRepo(ctx, workspaceID),
		environments:             environments.NewRepo(ctx, workspaceID),
		resources:                resources.NewRepo(ctx, workspaceID),
		systems:                  systems.NewRepo(ctx, workspaceID),
		jobAgents:                jobagents.NewRepo(ctx, workspaceID),
		jobs:                     jobs.NewRepo(ctx, workspaceID),
		resourceProviders:        resourceproviders.NewRepo(ctx, workspaceID),
		releases:                 releases.NewRepo(ctx, workspaceID),
		systemDeployments:        systemdeployments.NewRepo(ctx),
		systemEnvironments:       systemenvironments.NewRepo(ctx),
		policies:                 policies.NewRepo(ctx, workspaceID),
		userApprovalRecords:      userapprovalrecords.NewRepo(ctx),
		resourceVariables:        resourcevariables.NewRepo(ctx, workspaceID),
		deploymentVariables:      deploymentvariables.NewVariableRepo(ctx, workspaceID),
		deploymentVariableValues: deploymentvariables.NewValueRepo(ctx, workspaceID),
		workflows:                workflows.NewWorkflowRepo(ctx, workspaceID),
		workflowJobTemplates:     workflows.NewWorkflowJobTemplateRepo(ctx, workspaceID),
		workflowRuns:             workflows.NewWorkflowRunRepo(ctx, workspaceID),
		workflowJobs:             workflows.NewWorkflowJobRepo(ctx, workspaceID),
	}
}
