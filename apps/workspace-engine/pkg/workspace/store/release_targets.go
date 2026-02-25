package store

import (
	"context"
	"fmt"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/store/repository/memory/indexstore"

	"go.opentelemetry.io/otel"
)

var tracer = otel.Tracer("workspace/store/release_targets")

func NewReleaseTargets(store *Store) *ReleaseTargets {
	db := store.repo.DB()
	getKey := func(entity *oapi.ReleaseTarget) string {
		return entity.Key()
	}
	rt := &ReleaseTargets{
		store:          store,
		releaseTargets: indexstore.NewStore(db, "release_target", getKey),
	}
	return rt
}

type ReleaseTargets struct {
	store *Store

	releaseTargets *indexstore.Store[*oapi.ReleaseTarget]
}

// CurrentState returns the current state of all release targets in the system.
func (r *ReleaseTargets) Items() (map[string]*oapi.ReleaseTarget, error) {
	return r.releaseTargets.Items(), nil
}

func (r *ReleaseTargets) Upsert(ctx context.Context, releaseTarget *oapi.ReleaseTarget) error {
	r.releaseTargets.Set(releaseTarget)
	r.store.changeset.RecordUpsert(releaseTarget)
	return nil
}

func (r *ReleaseTargets) Get(key string) *oapi.ReleaseTarget {
	releaseTarget, ok := r.releaseTargets.Get(key)
	if !ok {
		return nil
	}
	return releaseTarget
}

func (r *ReleaseTargets) Remove(key string) {
	r.store.changeset.RecordDelete(r.Get(key))
	r.releaseTargets.Remove(key)
}

func (r *ReleaseTargets) GetCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*oapi.Release, *oapi.Job, error) {
	if releaseTarget == nil {
		return nil, nil, fmt.Errorf("releaseTarget is nil")
	}
	jobs := r.store.Jobs.GetJobsForReleaseTarget(releaseTarget)

	// Collect all successful jobs with non-nil CompletedAt
	successfulJobs := make([]*oapi.Job, 0)
	for _, job := range jobs {
		if job.Status == oapi.JobStatusSuccessful && job.CompletedAt != nil {
			successfulJobs = append(successfulJobs, job)
		}
	}

	if len(successfulJobs) == 0 {
		return nil, nil, fmt.Errorf("no successful job found")
	}

	// Sort jobs by CompletedAt in descending order (newest first)
	sort.Slice(successfulJobs, func(i, j int) bool {
		return successfulJobs[i].CompletedAt.After(*successfulJobs[j].CompletedAt)
	})

	// Iterate through jobs and find the first valid release
	// A job is valid if it has no verifications, or ALL its verifications have passed
	for _, job := range successfulJobs {
		release, ok := r.store.Releases.Get(job.ReleaseId)
		if !ok || release == nil {
			continue
		}

		// Check verification status for this job
		// GetJobVerificationStatus returns empty string if no verifications
		status := r.store.JobVerifications.GetJobVerificationStatus(job.Id)

		// If no verifications exist or all passed, job is valid
		if status == "" || status == oapi.JobVerificationStatusPassed {
			return release, job, nil
		}

		// Otherwise, skip this job and check the next one
	}

	return nil, nil, fmt.Errorf("no valid release found (all jobs have failed/running/cancelled verifications)")
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

func (r *ReleaseTargets) GetPolicies(ctx context.Context, releaseTarget *oapi.ReleaseTarget) ([]*oapi.Policy, error) {
	policiesSlice := []*oapi.Policy{}

	environment, ok := r.store.Environments.Get(releaseTarget.EnvironmentId)
	if !ok {
		return nil, fmt.Errorf("environment %s not found", releaseTarget.EnvironmentId)
	}
	deployment, ok := r.store.Deployments.Get(releaseTarget.DeploymentId)
	if !ok {
		return nil, fmt.Errorf("deployment %s not found", releaseTarget.DeploymentId)
	}
	resource, ok := r.store.Resources.Get(releaseTarget.ResourceId)
	if !ok {
		return nil, fmt.Errorf("resource %s not found", releaseTarget.ResourceId)
	}

	resolved := selector.NewResolvedReleaseTarget(environment, deployment, resource)
	policies := r.store.Policies.Items()
	for _, policy := range policies {
		if selector.MatchPolicy(ctx, policy, resolved) {
			policiesSlice = append(policiesSlice, policy)
		}
	}

	return policiesSlice, nil
}

func (r *ReleaseTargets) GetForResource(ctx context.Context, resourceId string) []*oapi.ReleaseTarget {
	releaseTargets, err := r.releaseTargets.GetBy("resource_id", resourceId)
	if err != nil {
		return nil
	}
	return releaseTargets
}

func (r *ReleaseTargets) GetForDeployment(ctx context.Context, deploymentId string) ([]*oapi.ReleaseTarget, error) {
	return r.releaseTargets.GetBy("deployment_id", deploymentId)
}

func (r *ReleaseTargets) GetForEnvironment(ctx context.Context, environmentId string) ([]*oapi.ReleaseTarget, error) {
	return r.releaseTargets.GetBy("environment_id", environmentId)
}

func (r *ReleaseTargets) GetForSystem(ctx context.Context, systemId string) ([]*oapi.ReleaseTarget, error) {
	environments := r.store.Systems.Environments(systemId)
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, environment := range environments {
		envTargets, err := r.GetForEnvironment(ctx, environment.Id)
		if err != nil {
			return nil, err
		}
		releaseTargets = append(releaseTargets, envTargets...)
	}
	return releaseTargets, nil
}

func (r *ReleaseTargets) GetForPolicy(ctx context.Context, policy *oapi.Policy) (map[string]*oapi.ReleaseTarget, error) {
	targetMap := make(map[string]*oapi.ReleaseTarget)

	allReleaseTargets := r.releaseTargets.Items()
	for _, releaseTarget := range allReleaseTargets {
		environment, ok := r.store.Environments.Get(releaseTarget.EnvironmentId)
		if !ok {
			continue
		}
		deployment, ok := r.store.Deployments.Get(releaseTarget.DeploymentId)
		if !ok {
			continue
		}
		resource, ok := r.store.Resources.Get(releaseTarget.ResourceId)
		if !ok {
			continue
		}

		isMatch := selector.MatchPolicy(ctx, policy, selector.NewResolvedReleaseTarget(environment, deployment, resource))
		if isMatch {
			targetMap[releaseTarget.Key()] = releaseTarget
		}
	}

	return targetMap, nil
}

func (r *ReleaseTargets) RemoveForResource(ctx context.Context, resourceId string) {
	for _, releaseTarget := range r.GetForResource(ctx, resourceId) {
		if releaseTarget.ResourceId == resourceId {
			r.Remove(releaseTarget.Key())
		}
	}
}
