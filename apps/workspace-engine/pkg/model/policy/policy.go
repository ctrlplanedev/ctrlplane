package policy

import "workspace-engine/pkg/model/selector"

type Policy struct {
	ID          string
	WorkspaceID string
	Enabled     bool
	Priority    int
	Targets     []PolicyTarget
}

type PolicyTarget struct {
	PolicyID            string
	DeploymentSelector  *selector.Condition
	EnvironmentSelector *selector.Condition
	ResourceSelector    *selector.Condition
}
