package repository

type Repo interface {
	DeploymentVersions() DeploymentVersionRepo
	Deployments() DeploymentRepo
	Environments() EnvironmentRepo
	Resources() ResourceRepo
	Systems() SystemRepo
	JobAgents() JobAgentRepo
	Jobs() JobRepo
	ResourceProviders() ResourceProviderRepo
	Releases() ReleaseRepo
	SystemDeployments() SystemDeploymentRepo
	SystemEnvironments() SystemEnvironmentRepo
	Policies() PolicyRepo
	UserApprovalRecords() UserApprovalRecordRepo
	ResourceVariables() ResourceVariableRepo
	DeploymentVariables() DeploymentVariableRepo
	DeploymentVariableValues() DeploymentVariableValueRepo
	Workflows() WorkflowRepo
	WorkflowJobTemplates() WorkflowJobTemplateRepo
	WorkflowRuns() WorkflowRunRepo
	WorkflowJobs() WorkflowJobRepo
}
