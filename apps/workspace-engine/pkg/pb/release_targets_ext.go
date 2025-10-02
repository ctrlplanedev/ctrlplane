package pb

func (x *ReleaseTarget) Key() string {
	return x.ResourceId + "-" + x.EnvironmentId + "-" + x.DeploymentId
}
