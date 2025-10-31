package skipdeployed

import (
	"context"
	"fmt"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/releasemanager/policy/evaluator"
	"workspace-engine/pkg/workspace/releasemanager/policy/results"
	"workspace-engine/pkg/workspace/store"
)

var _ evaluator.Evaluator = &SkipDeployedEvaluator{}

// SkipDeployedEvaluator prevents re-deploying releases that are already successfully deployed.
// This ensures idempotency - the same release (version + variables + target) won't be deployed twice.
type SkipDeployedEvaluator struct {
	store *store.Store
}

func NewSkipDeployedEvaluator(store *store.Store) evaluator.Evaluator {
	return evaluator.WithMemoization(&SkipDeployedEvaluator{
		store: store,
	})
}

// ScopeFields declares that this evaluator cares about Release.
func (e *SkipDeployedEvaluator) ScopeFields() evaluator.ScopeFields {
	return evaluator.ScopeRelease
}

// Evaluate checks if the release has already been attempted.
// The memoization wrapper ensures Release is present.
// Returns:
//   - Denied: If the most recent job is for this exact release (regardless of status)
//   - Allowed: If not yet attempted or previous job was for a different release
func (e *SkipDeployedEvaluator) Evaluate(
	ctx context.Context,
	scope evaluator.EvaluatorScope,
) *oapi.RuleEvaluation {
	release := scope.Release
	releaseTarget := release.ReleaseTarget

	// Get all jobs for this release target
	jobs := e.store.Jobs.GetJobsForReleaseTarget(&releaseTarget)
	target, ok := e.store.Resources.Get(releaseTarget.ResourceId)
	if !ok {
		return results.NewDeniedResult("Resource not found")
	}

	// Find the most recent job (any status)
	var mostRecentJob *oapi.Job
	var mostRecentTime *time.Time

	for _, job := range jobs {
		// If the job was created before the target was created, ignore it
		if job.CreatedAt.Before(target.CreatedAt) {
			// resource might be added, then deleted and readded, so we need to ignore jobs created before the target was created
			continue
		}

		// Try to get completion time first
		jobTime := job.CreatedAt

		// Track the most recent job
		if mostRecentTime == nil || jobTime.After(*mostRecentTime) {
			mostRecentTime = &jobTime
			mostRecentJob = job
		}
	}

	// No jobs found - not attempted yet
	if mostRecentJob == nil {
		return results.
			NewAllowedResult("No previous deployment found").
			WithDetail("release_id", release.ID())
	}

	// Check if the most recent job is for the same release
	if mostRecentJob.ReleaseId == release.ID() {
		// Already attempted this exact release - deny
		return results.
			NewDeniedResult(
				fmt.Sprintf("Release already attempted (job: %s, status: %s)", mostRecentJob.Id, mostRecentJob.Status),
			).
			WithDetail("release_id", release.ID()).
			WithDetail("existing_job_id", mostRecentJob.Id).
			WithDetail("job_status", string(mostRecentJob.Status)).
			WithDetail("version", release.Version.Tag)
	}

	// Most recent job is for a different release - allow this one
	return results.
		NewAllowedResult(
			fmt.Sprintf("Different release deployed (previous: %s, new: %s)", mostRecentJob.ReleaseId, release.ID()),
		).
		WithDetail("release_id", release.ID()).
		WithDetail("previous_release_id", mostRecentJob.ReleaseId).
		WithDetail("version", release.Version.Tag)
}
