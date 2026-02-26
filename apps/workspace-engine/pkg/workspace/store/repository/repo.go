package repository

type Repo interface {
	DeploymentVersions() DeploymentVersionRepo
	Deployments() DeploymentRepo
	Environments() EnvironmentRepo
	Resources() ResourceRepo
	Systems() SystemRepo
	JobAgents() JobAgentRepo
	ResourceProviders() ResourceProviderRepo
	Releases() ReleaseRepo
	SystemDeployments() SystemDeploymentRepo
	SystemEnvironments() SystemEnvironmentRepo
	Policies() PolicyRepo
	UserApprovalRecords() UserApprovalRecordRepo
	ResourceVariables() ResourceVariableRepo
}
