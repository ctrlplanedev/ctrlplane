package skipdeployed

import (
	"context"
	"fmt"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/releasemanager/policymanager/results"
	"workspace-engine/pkg/workspace/store"
)

var _ results.ReleaseRuleEvaluator = &SkipDeployedEvaluator{}

// SkipDeployedEvaluator prevents re-deploying releases that are already successfully deployed.
// This ensures idempotency - the same release (version + variables + target) won't be deployed twice.
type SkipDeployedEvaluator struct {
	store *store.Store
}

func NewSkipDeployedEvaluator(store *store.Store) *SkipDeployedEvaluator {
	return &SkipDeployedEvaluator{
		store: store,
	}
}

// Evaluate checks if the release is already deployed.
// Returns:
//   - Denied: If the most recent successful job is for this exact release
//   - Allowed: If not yet deployed or previous deployment failed
func (e *SkipDeployedEvaluator) Evaluate(
	ctx context.Context,
	releaseTarget *pb.ReleaseTarget,
	release *pb.Release,
) (*results.RuleEvaluationResult, error) {
	// Get most recent job for this release target
	mostRecentJob, err := e.store.Jobs.MostRecentForReleaseTarget(ctx, releaseTarget)
	if err != nil {
		// No jobs found - not deployed yet
		return results.
			NewAllowedResult("No previous deployment found").
			WithDetail("release_id", release.ID()), nil
	}

	// Check if the most recent job completed successfully
	if mostRecentJob.Status != pb.JobStatus_JOB_STATUS_SUCCESSFUL {
		// Last deployment wasn't successful - allow re-deploy
		return results.
			NewAllowedResult(
				fmt.Sprintf("Previous deployment was not successful (status: %s)", mostRecentJob.Status),
			).
			WithDetail("release_id", release.ID()).
			WithDetail("previous_job_id", mostRecentJob.Id).
			WithDetail("previous_job_status", mostRecentJob.Status.String()), nil
	}

	// Check if the successful job is for the same release
	if mostRecentJob.ReleaseId == release.ID() {
		// Already deployed this exact release - deny
		return results.
			NewDeniedResult(
				fmt.Sprintf("Release already deployed successfully (job: %s)", mostRecentJob.Id),
			).
			WithDetail("release_id", release.ID()).
			WithDetail("existing_job_id", mostRecentJob.Id).
			WithDetail("version", release.Version.Tag), nil
	}

	// Most recent successful job is for a different release - allow this one
	return results.
		NewAllowedResult(
			fmt.Sprintf("Different release deployed (previous: %s, new: %s)", mostRecentJob.ReleaseId, release.ID()),
		).
		WithDetail("release_id", release.ID()).
		WithDetail("previous_release_id", mostRecentJob.ReleaseId).
		WithDetail("version", release.Version.Tag), nil
}