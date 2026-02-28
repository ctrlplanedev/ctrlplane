package policyeval

import (
	"context"

	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/approval"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deployableversions"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator/deploymentwindow"
)

var _ approval.Getters = (*approvalAdapter)(nil)

type approvalAdapter struct {
	getter Getter
	ctx    context.Context
}

func (a *approvalAdapter) GetApprovalRecords(versionID, environmentID string) []*oapi.UserApprovalRecord {
	records, _ := a.getter.GetApprovalRecords(a.ctx, versionID, environmentID)
	return records
}

var _ deploymentwindow.Getters = (*deploymentWindowAdapter)(nil)

type deploymentWindowAdapter struct {
	getter Getter
	ctx    context.Context
}

func (a *deploymentWindowAdapter) HasCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) bool {
	has, _ := a.getter.HasCurrentRelease(ctx, releaseTarget)
	return has
}

var _ deployableversions.Getters = (*deployableVersionsAdapter)(nil)

type deployableVersionsAdapter struct {
	getter Getter
	ctx    context.Context
	rt     *oapi.ReleaseTarget
}

func (a *deployableVersionsAdapter) GetReleases() map[string]*oapi.Release {
	release, _ := a.getter.GetCurrentRelease(a.ctx, a.rt)
	if release == nil {
		return nil
	}
	return map[string]*oapi.Release{release.ID(): release}
}
