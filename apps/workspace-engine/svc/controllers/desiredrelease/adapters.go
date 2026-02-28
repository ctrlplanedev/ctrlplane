package desiredrelease

import (
	"context"
	"time"

	"workspace-engine/pkg/oapi"
)

// policyevalAdapter bridges the desiredrelease Getter (which uses
// *ReleaseTarget) to the policyeval.Getter interface (which uses
// *oapi.ReleaseTarget).
type policyevalAdapter struct {
	getter Getter
	rt     *ReleaseTarget
}

func (a *policyevalAdapter) GetApprovalRecords(ctx context.Context, versionID, environmentID string) ([]*oapi.UserApprovalRecord, error) {
	return a.getter.GetApprovalRecords(ctx, versionID, environmentID)
}

func (a *policyevalAdapter) HasCurrentRelease(ctx context.Context, _ *oapi.ReleaseTarget) (bool, error) {
	return a.getter.HasCurrentRelease(ctx, a.rt)
}

func (a *policyevalAdapter) GetCurrentRelease(ctx context.Context, _ *oapi.ReleaseTarget) (*oapi.Release, error) {
	return a.getter.GetCurrentRelease(ctx, a.rt)
}

func (a *policyevalAdapter) GetPolicySkips(ctx context.Context, versionID, environmentID, resourceID string) ([]*oapi.PolicySkip, error) {
	return a.getter.GetPolicySkips(ctx, versionID, environmentID, resourceID)
}

func buildRelease(rt *ReleaseTarget, version *oapi.DeploymentVersion) *oapi.Release {
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  rt.DeploymentID.String(),
			EnvironmentId: rt.EnvironmentID.String(),
			ResourceId:    rt.ResourceID.String(),
		},
		Version:            *version,
		Variables:          map[string]oapi.LiteralValue{},
		EncryptedVariables: []string{},
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
}
