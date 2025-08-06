package policy

import (
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type PolicyTargetSelector struct {
	ID string

	ResourceSelector    selector.Selector[resource.Resource]
	EnvironmentSelector selector.Selector[environment.Environment]
	DeploymentSelector  selector.Selector[deployment.Deployment]
}
