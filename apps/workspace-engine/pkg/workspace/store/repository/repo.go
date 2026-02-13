package repository

type Repo interface {
	DeploymentVersions() DeploymentVersionRepo
	Deployments() DeploymentRepo
	Environments() EnvironmentRepo
	Systems() SystemRepo
}
