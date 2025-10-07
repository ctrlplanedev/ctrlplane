package skipdeployed

import (
	"context"
	"fmt"
	"time"
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

// Evaluate checks if the release has already been attempted.
// Returns:
//   - Denied: If the most recent job is for this exact release (regardless of status)
//   - Allowed: If not yet attempted or previous job was for a different release
func (e *SkipDeployedEvaluator) Evaluate(
	ctx context.Context,
	releaseTarget *pb.ReleaseTarget,
	release *pb.Release,
) (*results.RuleEvaluationResult, error) {
	// Get all jobs for this release target
	jobs := e.store.Jobs.GetJobsForReleaseTarget(releaseTarget)

	// Find the most recent job (any status)
	var mostRecentJob *pb.Job
	var mostRecentTime *time.Time

	for _, job := range jobs {
		// Try to get completion time first
		completedAt, err := job.CompletedAtTime()
		var jobTime *time.Time
		
		if err == nil && completedAt != nil {
			jobTime = completedAt
		} else {
			// If not completed, use created time
			createdAt, err := job.CreatedAtTime()
			if err != nil {
				continue
			}
			jobTime = &createdAt
		}

		// Track the most recent job
		if mostRecentTime == nil || jobTime.After(*mostRecentTime) {
			mostRecentTime = jobTime
			mostRecentJob = job
		}
	}

	// No jobs found - not attempted yet
	if mostRecentJob == nil {
		return results.
			NewAllowedResult("No previous deployment found").
			WithDetail("release_id", release.ID()), nil
	}

	// Check if the most recent job is for the same release
	if mostRecentJob.ReleaseId == release.ID() {
		// Already attempted this exact release - deny
		return results.
			NewDeniedResult(
				fmt.Sprintf("Release already attempted (job: %s, status: %s)", mostRecentJob.Id, mostRecentJob.Status.String()),
			).
			WithDetail("release_id", release.ID()).
			WithDetail("existing_job_id", mostRecentJob.Id).
			WithDetail("job_status", mostRecentJob.Status.String()).
			WithDetail("version", release.Version.Tag), nil
	}

	// Most recent job is for a different release - allow this one
	return results.
		NewAllowedResult(
			fmt.Sprintf("Different release deployed (previous: %s, new: %s)", mostRecentJob.ReleaseId, release.ID()),
		).
		WithDetail("release_id", release.ID()).
		WithDetail("previous_release_id", mostRecentJob.ReleaseId).
		WithDetail("version", release.Version.Tag), nil
}