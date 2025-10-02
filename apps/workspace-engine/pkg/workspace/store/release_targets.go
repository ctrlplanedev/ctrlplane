package store

import (
	"context"
	"workspace-engine/pkg/pb"
)

type ReleaseTargets struct {
	store *Store
}

// CurrentState returns the current state of all release targets in the system.
func (r *ReleaseTargets) Items(ctx context.Context) map[string]*pb.ReleaseTarget {
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
				if !deployments.HasResources(deployment.Id, resource.Id) {
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

	return releaseTargets
}
