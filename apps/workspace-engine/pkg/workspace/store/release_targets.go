package store

import (
	"context"
	"fmt"
	"strings"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/selector"
	"workspace-engine/pkg/workspace/store/materialized"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
)

var tracer = otel.Tracer("workspace/store/release_targets")

func NewReleaseTargets(store *Store) *ReleaseTargets {
	rt := &ReleaseTargets{}
	rt.store = store
	rt.targets = materialized.New(rt.computeTargets)
	return rt
}

type ReleaseTargets struct {
	store *Store

	targets *materialized.MaterializedView[map[string]*oapi.ReleaseTarget]
}

func (r *ReleaseTargets) FromId(id string) *oapi.ReleaseTarget {
	target := &oapi.ReleaseTarget{}
	t := strings.Split(id, "-")
	if len(t) != 3 {
		return nil
	}
	target.ResourceId = t[0]
	target.EnvironmentId = t[1]
	target.DeploymentId = t[2]

	return target
}

// CurrentState returns the current state of all release targets in the system.
func (r *ReleaseTargets) Items(ctx context.Context) (map[string]*oapi.ReleaseTarget, error) {
	if err := r.targets.WaitIfRunning(); err != nil && !materialized.IsAlreadyStarted(err) {
		return nil, err
	}
	return r.targets.Get(), nil
}

func (r *ReleaseTargets) Recompute(ctx context.Context) error {
	return r.targets.StartRecompute(ctx)
}

func (r *ReleaseTargets) computeTargets(ctx context.Context) (map[string]*oapi.ReleaseTarget, error) {
	_, span := tracer.Start(ctx, "computeTargets")
	defer span.End()

	environments := r.store.Environments
	deployments := r.store.Deployments

	// Index deployments by SystemId to avoid O(E*D) nested loop
	deploymentsBySystem := make(map[string][]*oapi.Deployment)
	for depItem := range deployments.IterBuffered() {
		deployment := depItem.Val
		deploymentsBySystem[deployment.SystemId] = append(deploymentsBySystem[deployment.SystemId], deployment)
	}

	// Pre-allocate based on a reasonable estimate
	releaseTargets := make(map[string]*oapi.ReleaseTarget, 1000)

	for envItem := range environments.IterBuffered() {
		environment := envItem.Val

		// Only process deployments in the same system
		systemDeployments, ok := deploymentsBySystem[environment.SystemId]
		if !ok {
			continue
		}

		// Get environment resources once per environment
		envResources, err := environments.Resources(environment.Id)
		if err != nil {
			log.Error("Failed to get environment resources", "environmentId", environment.Id, "error", err)
			return nil, err
		}

		if len(envResources) == 0 {
			continue
		}

		for _, deployment := range systemDeployments {
			// Get deployment resources once per deployment
			depResources, err := deployments.Resources(deployment.Id)
			if err != nil {
				log.Error("Failed to get deployment resources", "deploymentId", deployment.Id, "error", err)
				return nil, err
			}

			if len(depResources) == 0 {
				continue
			}

			// Find intersection of resources
			for resourceId := range envResources {
				if _, hasResource := depResources[resourceId]; hasResource {
					target := &oapi.ReleaseTarget{
						EnvironmentId: environment.Id,
						DeploymentId:  deployment.Id,
						ResourceId:    resourceId,
					}
					// Use the standard Key() method for consistency
					releaseTargets[target.Key()] = target
				}
			}
		}
	}

	span.SetAttributes(attribute.Int("count", len(releaseTargets)))

	return releaseTargets, nil
}

func (r *ReleaseTargets) computePolicies(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (map[string]*oapi.Policy, error) {
	_, span := tracer.Start(ctx, "computePolicies")
	defer span.End()

	environments, ok := r.store.Environments.Get(releaseTarget.EnvironmentId)
	if !ok {
		span.SetAttributes(attribute.String("environment.id", releaseTarget.EnvironmentId))
		span.SetStatus(codes.Error, "Environment not found")
		span.RecordError(fmt.Errorf("environment %s not found", releaseTarget.EnvironmentId))
		return nil, fmt.Errorf("environment %s not found", releaseTarget.EnvironmentId)
	}
	deployments, ok := r.store.Deployments.Get(releaseTarget.DeploymentId)
	if !ok {
		span.SetAttributes(attribute.String("deployment.id", releaseTarget.DeploymentId))
		span.SetStatus(codes.Error, "Deployment not found")
		span.RecordError(fmt.Errorf("deployment %s not found", releaseTarget.DeploymentId))
		return nil, fmt.Errorf("deployment %s not found", releaseTarget.DeploymentId)
	}
	resources, ok := r.store.Resources.Get(releaseTarget.ResourceId)
	if !ok {
		span.SetAttributes(attribute.String("resource.id", releaseTarget.ResourceId))
		span.SetStatus(codes.Error, "Resource not found")
		span.RecordError(fmt.Errorf("resource %s not found", releaseTarget.ResourceId))
		return nil, fmt.Errorf("resource %s not found", releaseTarget.ResourceId)
	}

	resolvedReleaseTarget := selector.NewBasicReleaseTarget(environments, deployments, resources)
	matchingPolicies := make(map[string]*oapi.Policy)

	for policyItem := range r.store.Policies.IterBuffered() {
		policy := policyItem.Val
		if selector.MatchPolicy(ctx, policy, resolvedReleaseTarget) {
			matchingPolicies[policy.Id] = policy
		}
	}

	return matchingPolicies, nil
}

func (r *ReleaseTargets) GetPolicies(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (map[string]*oapi.Policy, error) {
	return r.computePolicies(ctx, releaseTarget)
}

func (r *ReleaseTargets) Get(key string) *oapi.ReleaseTarget {
	return r.targets.Get()[key]
}

func (r *ReleaseTargets) GetCurrentRelease(ctx context.Context, releaseTarget *oapi.ReleaseTarget) (*oapi.Release, *oapi.Job, error) {
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
	if !ok {
		return nil, nil, fmt.Errorf("release %s not found", mostRecentJob.ReleaseId)
	}
	return release, mostRecentJob, nil
}
