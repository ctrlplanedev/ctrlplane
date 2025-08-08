package workspace

import (
	epolicy "workspace-engine/pkg/engine/policy"
	"workspace-engine/pkg/engine/policy/releasetargets"
)

type WorkspaceRepository struct {
	ReleaseTarget *releasetargets.ReleaseTargetRepository
	Policy        *epolicy.PolicyRepository
}

func NewWorkspaceRepository() *WorkspaceRepository {
	return &WorkspaceRepository{
		ReleaseTarget: releasetargets.NewReleaseTargetRepository(),
		Policy:        epolicy.NewPolicyRepository(),
	}
}
