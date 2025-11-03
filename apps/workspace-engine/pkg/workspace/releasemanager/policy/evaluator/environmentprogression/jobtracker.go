package environmentprogression

import (
	"context"
	"sort"
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

		if t.SuccessStatuses[job.Status] && job.CompletedAt != nil {
			targetKey := release.ReleaseTarget.Key()
			// Store the oldest successful completion time for this release target
			if existingTime, exists := t.successfulReleaseTargets[targetKey]; !exists || job.CompletedAt.Before(existingTime) {
				t.successfulReleaseTargets[targetKey] = *job.CompletedAt
			}
			if t.mostRecentSuccess.Before(*job.CompletedAt) {
				t.mostRecentSuccess = *job.CompletedAt
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

	// Build a set of release target keys for filtering
	rtKeys := make(map[string]bool)
	for _, rt := range t.ReleaseTargets {
		rtKeys[rt.Key()] = true
	}

	// Count only successful release targets that are in t.ReleaseTargets
	successfulCount := 0
	for targetKey := range t.successfulReleaseTargets {
		if rtKeys[targetKey] {
			successfulCount++
		}
	}

	return float32(successfulCount) / float32(numRt) * 100
}

// GetSuccessPercentageSatisfiedAt returns the earliest time at which the minimum success percentage
// was satisfied. If it has never been satisfied, returns zero time.
func (t *ReleaseTargetJobTracker) GetSuccessPercentageSatisfiedAt(minimumSuccessPercentage float32) time.Time {
	if minimumSuccessPercentage <= 0 {
		minimumSuccessPercentage = 100.0
	}
	numRt := len(t.ReleaseTargets)
	if numRt == 0 {
		return time.Time{}
	}

	// Build a set of release target keys for filtering
	rtKeys := make(map[string]bool)
	for _, rt := range t.ReleaseTargets {
		rtKeys[rt.Key()] = true
	}

	// Collect success times only for release targets that are in t.ReleaseTargets
	var successTimes []time.Time
	for targetKey, completedAt := range t.successfulReleaseTargets {
		if rtKeys[targetKey] {
			successTimes = append(successTimes, completedAt)
		}
	}
	if len(successTimes) == 0 {
		return time.Time{}
	}

	// Sort by time ascending for historical simulation as successes accumulate
	sort.Slice(successTimes, func(i, j int) bool {
		return successTimes[i].Before(successTimes[j])
	})

	required := int(float32(numRt)*minimumSuccessPercentage/100.0 + 0.9999) // ceil
	if required == 0 {
		required = 1
	}
	if len(successTimes) < required {
		return time.Time{}
	}
	return successTimes[required-1]
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

// GetEarliestSuccess returns the earliest successful completion time across all release targets.
func (t *ReleaseTargetJobTracker) GetEarliestSuccess() time.Time {
	if len(t.successfulReleaseTargets) == 0 {
		return time.Time{}
	}

	var earliest time.Time
	first := true
	for _, completedAt := range t.successfulReleaseTargets {
		if first || completedAt.Before(earliest) {
			earliest = completedAt
			first = false
		}
	}
	return earliest
}

func (t *ReleaseTargetJobTracker) IsWithinMaxAge(maxAge time.Duration) bool {
	if t.mostRecentSuccess.IsZero() {
		return false
	}
	return time.Since(t.mostRecentSuccess) <= maxAge
}
