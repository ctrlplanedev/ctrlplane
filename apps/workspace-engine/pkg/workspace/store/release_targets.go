package store

import (
	"context"
	"fmt"
	"sort"
	"workspace-engine/pkg/oapi"

	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace/store/release_targets")

func NewReleaseTargets(store *Store) *ReleaseTargets {
	rt := &ReleaseTargets{
		store:   store,
		targets: make(map[string]*oapi.ReleaseTarget),
	}
	return rt
}

type ReleaseTargets struct {
	store *Store

	targets map[string]*oapi.ReleaseTarget
}

// CurrentState returns the current state of all release targets in the system.
func (r *ReleaseTargets) Items() (map[string]*oapi.ReleaseTarget, error) {
	return r.targets, nil
}

func (r *ReleaseTargets) Upsert(ctx context.Context, releaseTarget *oapi.ReleaseTarget) error {
	r.targets[releaseTarget.Key()] = releaseTarget
	r.store.changeset.RecordUpsert(releaseTarget)
	return nil
}

func (r *ReleaseTargets) Get(key string) *oapi.ReleaseTarget {
	releaseTarget, ok := r.targets[key]
	if !ok {
		return nil
	}
	return releaseTarget
}

func (r *ReleaseTargets) Remove(key string) {
	r.store.changeset.RecordDelete(r.Get(key))
	delete(r.targets, key)
}

func (r *ReleaseTargets) GetCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*oapi.Release, *oapi.Job, error) {
	if releaseTarget == nil {
		return nil, nil, fmt.Errorf("releaseTarget is nil")
	}
	jobs := r.store.Jobs.GetJobsForReleaseTarget(releaseTarget)
	var mostRecentJob *oapi.Job

	for _, job := range jobs {
		if job.Status != oapi.Successful {
			continue
		}

		if job.CompletedAt == nil {
			continue
		}

		if mostRecentJob == nil || mostRecentJob.CompletedAt == nil || job.CompletedAt.After(*mostRecentJob.CompletedAt) {
			mostRecentJob = job
		}
	}

	if mostRecentJob == nil {
		return nil, nil, fmt.Errorf("no successful job found")
	}

	release, ok := r.store.Releases.Get(mostRecentJob.ReleaseId)
	if !ok || release == nil {
		return nil, nil, fmt.Errorf("release %s not found", mostRecentJob.ReleaseId)
	}
	return release, mostRecentJob, nil
}

func (r *ReleaseTargets) GetLatestJob(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*oapi.Job, error) {
	jobs := r.store.Jobs.GetJobsForReleaseTarget(releaseTarget)
	if len(jobs) == 0 {
		return nil, fmt.Errorf("no jobs found for release target")
	}

	jobsList := make([]*oapi.Job, 0, len(jobs))
	for _, job := range jobs {
		jobsList = append(jobsList, job)
	}

	// Sort jobs by CreatedAt in descending order (newest first)
	sort.Slice(jobsList, func(i, j int) bool {
		return jobsList[i].CreatedAt.After(jobsList[j].CreatedAt)
	})

	if len(jobsList) == 0 {
		return nil, fmt.Errorf("no jobs found for release target")
	}

	return jobsList[0], nil
}
