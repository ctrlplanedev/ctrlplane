package policy

import "workspace-engine/pkg/model/policy/rules"

type Policy struct {
	ID string `json:"id"`

	WorkspaceID string `json:"workspaceId"`

	Name string `json:"name"`

	Priority int `json:"priority"`

	PolicyTargets []PolicyTarget `json:"policyTargets"`

	EnvironmentVersionRolloutRule *rules.EnvironmentVersionRolloutRule `json:"environmentVersionRolloutRule,omitempty"`
}

func (p Policy) GetID() string {
	return p.ID
}
