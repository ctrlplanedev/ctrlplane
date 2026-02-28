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

// variableResolverAdapter bridges the desiredrelease Getter to the
// variableresolver.Getter interface.
type variableResolverAdapter struct {
	getter Getter
}

func (a *variableResolverAdapter) GetDeploymentVariables(ctx context.Context, deploymentID string) ([]oapi.DeploymentVariableWithValues, error) {
	return a.getter.GetDeploymentVariables(ctx, deploymentID)
}

func (a *variableResolverAdapter) GetResourceVariables(ctx context.Context, resourceID string) (map[string]oapi.ResourceVariable, error) {
	return a.getter.GetResourceVariables(ctx, resourceID)
}

func (a *variableResolverAdapter) GetRelatedEntity(ctx context.Context, resourceID, reference string) ([]*oapi.EntityRelation, error) {
	return a.getter.GetRelatedEntity(ctx, resourceID, reference)
}

func buildRelease(rt *ReleaseTarget, version *oapi.DeploymentVersion, variables map[string]oapi.LiteralValue) *oapi.Release {
	return &oapi.Release{
		ReleaseTarget: oapi.ReleaseTarget{
			DeploymentId:  rt.DeploymentID.String(),
			EnvironmentId: rt.EnvironmentID.String(),
			ResourceId:    rt.ResourceID.String(),
		},
		Version:            *version,
		Variables:          variables,
		EncryptedVariables: []string{},
		CreatedAt:          time.Now().Format(time.RFC3339),
	}
}
