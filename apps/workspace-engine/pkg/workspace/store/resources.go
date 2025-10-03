package store

import (
	"context"
	"sync"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

type Resources struct {
	repo  *repository.Repository
	store *Store
}

func (r *Resources) Upsert(ctx context.Context, resource *pb.Resource) (*pb.Resource, error) {
	r.repo.Resources.Set(resource.Id, resource)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		r.recomputeAllEnvironments(ctx)
	}()
	go func() {
		defer wg.Done()
		r.recomputeAllDeployments(ctx)
	}()
	wg.Wait()

	return resource, nil
}

func (r *Resources) recomputeAllEnvironments(ctx context.Context) {
	// Iterate through all environments and recompute their resource selectors
	for item := range r.repo.Environments.IterBuffered() {
		env := item.Val
		// Fire and forget - errors are logged but don't block
		if err := r.store.Environments.RecomputeResources(ctx, env.Id); err != nil {
			log.Error("error recomputing environment resource selectors", "error", err.Error())
		}
	}
}

func (r *Resources) recomputeAllDeployments(ctx context.Context) {
	for item := range r.repo.Deployments.IterBuffered() {
		env := item.Val
		if err := r.store.Deployments.RecomputeResources(ctx, env.Id); err != nil {
			log.Error("error recomputing deployment resource selectors", "error", err.Error())
		}
	}
}

func (r *Resources) Remove(id string) {
	r.repo.Resources.Remove(id)
}
