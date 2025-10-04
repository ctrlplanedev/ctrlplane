package pb

type Rule interface {
	ID() string
	PolicyID() string
	CanDeploy(version *DeploymentVersion) bool
}

