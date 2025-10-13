package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/materialized"

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
func (r *ReleaseTargets) Items(ctx context.Context) map[string]*oapi.ReleaseTarget {
	_ = r.targets.WaitIfRunning()
	return r.targets.Get()
}

func (r *ReleaseTargets) Recompute(ctx context.Context) {
	_ = r.targets.StartRecompute(ctx)
}

func (r *ReleaseTargets) computeTargets(ctx context.Context) (map[string]*oapi.ReleaseTarget, error) {
	_, span := tracer.Start(ctx, "computeTargets")
	defer span.End()

	releaseTargets := make(map[string]*oapi.ReleaseTarget, 1000)

	environments := r.store.Environments
	deployments := r.store.Deployments

	for envItem := range environments.IterBuffered() {
		environment := envItem.Val

		for depItem := range deployments.IterBuffered() {
			deployment := depItem.Val

			if environment.SystemId != deployment.SystemId {
				continue
			}

			key := environment.Id + ":" + deployment.Id

			for _, resource := range environments.Resources(environment.Id) {
				if !deployments.HasResource(deployment.Id, resource.Id) {
					continue
				}
				releaseTargetId := key + ":" + resource.Id
				releaseTargets[releaseTargetId] = &oapi.ReleaseTarget{
					EnvironmentId: environment.Id,
					DeploymentId:  deployment.Id,
					ResourceId:    resource.Id,
				}
			}
		}
	}

	span.SetAttributes(attribute.Int("count", len(releaseTargets)))

	return releaseTargets, nil
}
