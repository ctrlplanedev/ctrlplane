package policy

import (
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
	"workspace-engine/pkg/model/resource"
)

type ReleaseTarget struct {
	EnvironmentID string
	ResourceID    string
	DeploymentID  string
}

type PolicyTarget struct {
	ID string

	EnvironmentResources selector.SelectorEngine[resource.Resource, environment.Environment]
	DeploymentResources  selector.SelectorEngine[resource.Resource, deployment.Deployment]
	Resources            selector.SelectorEngine[resource.Resource, selector.BaseSelector]
}

func (p PolicyTarget) GetID() string {
	return p.ID
}

func (p PolicyTarget) GetConditions() selector.Condition {
	return nil
}
