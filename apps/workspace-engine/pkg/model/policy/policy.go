package policy

type Policy struct {
	ID string `json:"id"`

	WorkspaceID string `json:"workspaceId"`

	Name string `json:"name"`

	Priority int `json:"priority"`

	PolicyTargets []PolicyTarget `json:"policyTargets"`
}

func (p Policy) GetID() string {
	return p.ID
}
