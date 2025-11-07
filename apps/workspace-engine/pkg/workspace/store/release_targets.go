package store

import (
	"context"
	"fmt"
	"sort"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"

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

	for _, policy := range r.store.Policies.Items() {
		for _, sel := range policy.Selectors {
			if sel.ResourceSelector == nil || sel.EnvironmentSelector == nil || sel.DeploymentSelector == nil {
				continue
			}

			isMatch := selector.MatchPolicy(ctx, policy, selector.NewResolvedReleaseTarget(environment, deployment, resource))
			if isMatch {
				policiesSlice = append(policiesSlice, policy)
				break
			}
		}
	}

	return policiesSlice, nil
}

func (r *ReleaseTargets) GetForResource(ctx context.Context, resourceId string) []*oapi.ReleaseTarget {
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range r.targets {
		if releaseTarget.ResourceId == resourceId {
			releaseTargets = append(releaseTargets, releaseTarget)
		}
	}
	return releaseTargets
}

func (r *ReleaseTargets) GetForDeployment(ctx context.Context, deploymentId string) ([]*oapi.ReleaseTarget, error) {
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range r.targets {
		if releaseTarget.DeploymentId == deploymentId {
			releaseTargets = append(releaseTargets, releaseTarget)
		}
	}
	return releaseTargets, nil
}

func (r *ReleaseTargets) GetForEnvironment(ctx context.Context, environmentId string) ([]*oapi.ReleaseTarget, error) {
	releaseTargets := make([]*oapi.ReleaseTarget, 0)
	for _, releaseTarget := range r.targets {
		if releaseTarget.EnvironmentId == environmentId {
			releaseTargets = append(releaseTargets, releaseTarget)
		}
	}
	return releaseTargets, nil
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

func (r *ReleaseTargets) RemoveForResource(ctx context.Context, resourceId string) {
	for _, releaseTarget := range r.targets {
		if releaseTarget.ResourceId == resourceId {
			r.Remove(releaseTarget.Key())
		}
	}
}
