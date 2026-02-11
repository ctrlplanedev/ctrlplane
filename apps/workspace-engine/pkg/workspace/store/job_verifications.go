package store

import (
	"context"
	"fmt"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"
)

type JobVerifications struct {
	repo  *repository.Repo
	store *Store
}

func NewJobVerifications(store *Store) *JobVerifications {
	return &JobVerifications{
		repo:  store.repo,
		store: store,
	}
}

func (j *JobVerifications) Upsert(ctx context.Context, verification *oapi.JobVerification) {
	j.repo.JobVerifications.Set(verification.Id, verification)
	j.store.changeset.RecordUpsert(verification)
}

func (j *JobVerifications) Update(ctx context.Context, id string, cb func(valueInMap *oapi.JobVerification) *oapi.JobVerification) (*oapi.JobVerification, error) {
	verification, ok := j.Get(id)
	if !ok {
		return nil, fmt.Errorf("verification not found: %s", id)
	}
	newVerification := j.repo.JobVerifications.Upsert(
		verification.Id, nil,
		func(exist bool, valueInMap *oapi.JobVerification, newValue *oapi.JobVerification) *oapi.JobVerification {
			clone := *valueInMap
			return cb(&clone)
		},
	)
	j.store.changeset.RecordUpsert(newVerification)
	return newVerification, nil
}

func (j *JobVerifications) Get(id string) (*oapi.JobVerification, bool) {
	return j.repo.JobVerifications.Get(id)
}

func (j *JobVerifications) Items() map[string]*oapi.JobVerification {
	return j.repo.JobVerifications.Items()
}

// GetByJobId returns ALL verifications for a specific job
func (j *JobVerifications) GetByJobId(jobId string) []*oapi.JobVerification {
	verifications := make([]*oapi.JobVerification, 0)
	for _, verification := range j.repo.JobVerifications.Items() {
		if verification.JobId == jobId {
			verifications = append(verifications, verification)
		}
	}

	// Sort by CreatedAt descending (newest first)
	sort.Slice(verifications, func(i, k int) bool {
		return verifications[i].CreatedAt.After(verifications[k].CreatedAt)
	})

	return verifications
}

// GetJobVerificationStatus returns the aggregate verification status for a job.
// Returns "passed" only if ALL verifications passed.
// Returns "running" if any are still running.
// Returns "failed" if any failed (and none running).
// Returns empty string if no verifications exist.
func (j *JobVerifications) GetJobVerificationStatus(jobId string) oapi.JobVerificationStatus {
	verifications := j.GetByJobId(jobId)
	if len(verifications) == 0 {
		return "" // No verifications
	}

	hasRunning := false
	hasFailed := false

	for _, v := range verifications {
		status := v.Status()
		switch status {
		case oapi.JobVerificationStatusRunning:
			hasRunning = true
		case oapi.JobVerificationStatusFailed, oapi.JobVerificationStatusCancelled:
			hasFailed = true
		}
	}

	if hasRunning {
		return oapi.JobVerificationStatusRunning
	}
	if hasFailed {
		return oapi.JobVerificationStatusFailed
	}
	return oapi.JobVerificationStatusPassed
}

// GetByReleaseId returns all verifications for jobs belonging to a release.
// This derives the release from job.releaseId for backwards compatibility.
func (j *JobVerifications) GetByReleaseId(releaseId string) []*oapi.JobVerification {
	verifications := make([]*oapi.JobVerification, 0)
	for _, verification := range j.repo.JobVerifications.Items() {
		job, ok := j.store.Jobs.Get(verification.JobId)
		if ok && job.ReleaseId == releaseId {
			verifications = append(verifications, verification)
		}
	}

	// Sort by CreatedAt descending (newest first)
	sort.Slice(verifications, func(i, k int) bool {
		return verifications[i].CreatedAt.After(verifications[k].CreatedAt)
	})

	return verifications
}
