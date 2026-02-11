package repository

type Repo interface {
	DeploymentVersions() DeploymentVersionRepo
}
