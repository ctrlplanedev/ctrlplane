package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/materialized"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
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

			// Pre-compute the env:deployment key part
			keyPrefix := environment.Id + ":" + deployment.Id + ":"

			// Find intersection of resources
			for resourceId := range envResources {
				if _, hasResource := depResources[resourceId]; hasResource {
					releaseTargetId := keyPrefix + resourceId
					releaseTargets[releaseTargetId] = &oapi.ReleaseTarget{
						EnvironmentId: environment.Id,
						DeploymentId:  deployment.Id,
						ResourceId:    resourceId,
					}
				}
			}
		}
	}

	span.SetAttributes(attribute.Int("count", len(releaseTargets)))

	return releaseTargets, nil
}
