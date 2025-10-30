package environmentprogression

import (
	"context"
	"time"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store"
)

func getReleaseTargets(ctx context.Context, store *store.Store, version *oapi.DeploymentVersion, environment *oapi.Environment) []*oapi.ReleaseTarget {
	releaseTargets, err := store.ReleaseTargets.Items(ctx)
	if err != nil {
		return nil
	}
	releaseTargetsList := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range releaseTargets {
		if releaseTarget.EnvironmentId == environment.Id && releaseTarget.DeploymentId == version.DeploymentId {
			releaseTargetsList = append(releaseTargetsList, releaseTarget)
		}
	}
	return releaseTargetsList
}

// ReleaseTargetJobTracker tracks release targets and their associated jobs for a specific
// environment and deployment version. It provides methods to query job statuses, success rates,
// and other metrics useful for policy evaluation.
type ReleaseTargetJobTracker struct {
	store *store.Store

	Environment     *oapi.Environment
	Version         *oapi.DeploymentVersion
	ReleaseTargets  []*oapi.ReleaseTarget
	SuccessStatuses map[oapi.JobStatus]bool

	// Cached computed values
	jobsByStatus             map[oapi.JobStatus]int
	jobsByTarget             map[string][]*oapi.Job
	jobs                     []*oapi.Job
	successfulReleaseTargets map[string]time.Time
	mostRecentSuccess        time.Time
}

// NewReleaseTargetJobTracker creates a new tracker for the given environment and version
func NewReleaseTargetJobTracker(
	ctx context.Context,
	store *store.Store,
	environment *oapi.Environment,
	version *oapi.DeploymentVersion,
	successStatuses map[oapi.JobStatus]bool,
) *ReleaseTargetJobTracker {
	// Default success statuses
	if successStatuses == nil {
		successStatuses = map[oapi.JobStatus]bool{
			oapi.Successful: true,
		}
	}

	// Get release targets for this environment and version
	releaseTargets := getReleaseTargets(ctx, store, version, environment)

	rtt := &ReleaseTargetJobTracker{
		store:           store,
		Environment:     environment,
		Version:         version,
		ReleaseTargets:  releaseTargets,
		SuccessStatuses: successStatuses,

		jobs:                     make([]*oapi.Job, 0),
		jobsByStatus:             make(map[oapi.JobStatus]int, 0),
		jobsByTarget:             make(map[string][]*oapi.Job, 0),
		successfulReleaseTargets: make(map[string]time.Time, 0),
	}

	rtt.compute()

	return rtt
}

func (t *ReleaseTargetJobTracker) Jobs() []*oapi.Job {
	return t.jobs
}

func (t *ReleaseTargetJobTracker) compute() []*oapi.Job {
	for _, job := range t.store.Jobs.Items() {
		release, ok := t.store.Releases.Get(job.ReleaseId)
		if !ok {
			continue
		}
		if release == nil {
			continue
		}
		if release.ReleaseTarget.EnvironmentId != t.Environment.Id {
			continue
		}
		if release.ReleaseTarget.DeploymentId != t.Version.DeploymentId {
			continue
		}
		if release.Version.Id != t.Version.Id {
			continue
		}

		if t.SuccessStatuses[job.Status] {
			if job.CompletedAt != nil {
				targetKey := release.ReleaseTarget.Key()
				// Store the oldest successful completion time for this release target
				if existingTime, exists := t.successfulReleaseTargets[targetKey]; !exists || job.CompletedAt.Before(existingTime) {
					t.successfulReleaseTargets[targetKey] = *job.CompletedAt
				}
				if t.mostRecentSuccess.Before(*job.CompletedAt) {
					t.mostRecentSuccess = *job.CompletedAt
				}
			}
		}

		t.jobsByStatus[job.Status]++
		t.jobs = append(t.jobs, job)
	}

	return t.jobs
}

// GetSuccessPercentage returns the percentage of release targets that have at least one successful job (0-100)
func (t *ReleaseTargetJobTracker) GetSuccessPercentage() float32 {
	numRt := len(t.ReleaseTargets)
	if numRt == 0 {
		return 0.0 // If no targets, consider it 100% successful
	}
	return float32(len(t.successfulReleaseTargets)) / float32(numRt) * 100
}

// MeetsSoakTimeRequirement checks if the latest successful completion across all release targets
// has soaked for at least the specified duration. Returns true if the soak time requirement is met.
func (t *ReleaseTargetJobTracker) MeetsSoakTimeRequirement(duration time.Duration) bool {
	return t.GetSoakTimeRemaining(duration) <= 0
}

func (t *ReleaseTargetJobTracker) GetSoakTimeRemaining(duration time.Duration) time.Duration {
	if duration == 0 {
		return time.Duration(0)
	}

	var mostRecentCompletion time.Time
	for _, completedAt := range t.successfulReleaseTargets {
		if completedAt.After(mostRecentCompletion) {
			mostRecentCompletion = completedAt
		}
	}

	return duration - time.Since(mostRecentCompletion)
}

func (t *ReleaseTargetJobTracker) GetMostRecentSuccess() time.Time {
	return t.mostRecentSuccess
}

func (t *ReleaseTargetJobTracker) IsWithinMaxAge(maxAge time.Duration) bool {
	if t.mostRecentSuccess.IsZero() {
		return false
	}
	return time.Since(t.mostRecentSuccess) <= maxAge
}
