package workspace

import (
	epolicy "workspace-engine/pkg/engine/policy"
)

type WorkspaceRepository struct {
	ReleaseTarget *epolicy.ReleaseTargetRepository
	Policy        *epolicy.PolicyRepository
}

func NewWorkspaceRepository() *WorkspaceRepository {
	return &WorkspaceRepository{
		ReleaseTarget: epolicy.NewReleaseTargetRepository(),
		Policy:        epolicy.NewPolicyRepository(),
	}
}
