package policy

import (
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type PolicyTargetSelector struct {
	ID string

	ResourceSelector    selector.Condition[resource.Resource]
	EnvironmentSelector selector.Condition[environment.Environment]
	DeploymentSelector  selector.Condition[deployment.Deployment]
}
