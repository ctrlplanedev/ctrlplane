package store

import (
	"context"
	"fmt"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/materialized"
)

func NewReleaseTargets(store *Store) *ReleaseTargets {
	rt := &ReleaseTargets{}
	rt.store = store
	rt.targets = materialized.New(rt.computeTargets)
	return rt
}

type ReleaseTargets struct {
	store *Store

	targets *materialized.MaterializedView[map[string]*pb.ReleaseTarget]
}

// CurrentState returns the current state of all release targets in the system.
func (r *ReleaseTargets) Items(ctx context.Context) map[string]*pb.ReleaseTarget {
	r.targets.WaitIfRunning()
	fmt.Println("ReleaseTargets.Items")
	return r.targets.Get()
}

func (r *ReleaseTargets) computeTargets() (map[string]*pb.ReleaseTarget, error) {
	releaseTargets := make(map[string]*pb.ReleaseTarget, 1000)

	environments := r.store.Environments
	deployments := r.store.Deployments

	for envItem := range environments.IterBuffered() {
		environment := envItem.Val

		for depItem := range deployments.IterBuffered() {
			deployment := depItem.Val

			if environment.SystemId != deployment.SystemId {
				continue
			}

			for _, resource := range environments.Resources(environment.Id) {
				if !deployments.HasResource(deployment.Id, resource.Id) {
					continue
				}

				releaseTargets[resource.Id] = &pb.ReleaseTarget{
					EnvironmentId: environment.Id,
					DeploymentId:  deployment.Id,
					ResourceId:    resource.Id,
				}
			}
		}
	}

	return releaseTargets, nil
}
