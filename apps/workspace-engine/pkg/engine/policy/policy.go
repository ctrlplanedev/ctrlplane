package policy

import (
	"workspace-engine/pkg/engine/selector"
	"workspace-engine/pkg/model/deployment"
	"workspace-engine/pkg/model/environment"
)

type ReleaseTarget struct {
	EnvironmentID string
	ResourceID    string
	DeploymentID  string
}

func (r ReleaseTarget) GetID() string {
	return r.ResourceID + r.DeploymentID + r.EnvironmentID
}

type PolicyTarget struct {
	ID string

	EnvironmentResources selector.SelectorEngine[ReleaseTarget, environment.Environment]
	DeploymentResources  selector.SelectorEngine[ReleaseTarget, deployment.Deployment]
	Resources            selector.SelectorEngine[ReleaseTarget, selector.BaseSelector]
}

func (p PolicyTarget) GetID() string {
	return p.ID
}

func (p PolicyTarget) GetConditions() selector.Condition {
	return nil
}
