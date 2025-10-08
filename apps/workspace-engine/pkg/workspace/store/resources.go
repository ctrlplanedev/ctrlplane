package store

import (
	"context"
	"sync"
	"workspace-engine/pkg/pb"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func NewResources(store *Store) *Resources {
	return &Resources{
		repo:  store.repo,
		store: store,
	}
}

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
		r.applyResourceToAllEnvironments(ctx, resource)
	}()
	go func() {
		defer wg.Done()
		r.applyResourceToAllDeployments(ctx, resource)
	}()
	wg.Wait()

	r.store.ReleaseTargets.Recompute(ctx)

	return resource, nil
}

func (r *Resources) applyResourceToAllEnvironments(ctx context.Context, resource *pb.Resource) {
	// Iterate through environments and apply the incremental update for this single resource
	// This is more efficient than recomputing all resources for each environment
	for item := range r.repo.Environments.IterBuffered() {
		environment := item.Val
		// Use ApplyResourceUpdate instead of RecomputeResources for efficiency
		// This only checks if the single resource matches, not all resources
		if err := r.store.Environments.ApplyResourceUpdate(ctx, environment.Id, resource); err != nil {
			log.Error("error applying resource update to environment", "error", err.Error())
		}
	}
}

func (r *Resources) applyResourceToAllDeployments(ctx context.Context, resource *pb.Resource) {
	// Iterate through deployments and apply the incremental update for this single resource
	// This is more efficient than recomputing all resources for each deployment
	for item := range r.repo.Deployments.IterBuffered() {
		deployment := item.Val
		// Use ApplyResourceUpdate instead of RecomputeResources for efficiency
		// This only checks if the single resource matches, not all resources
		if err := r.store.Deployments.ApplyResourceUpdate(ctx, deployment.Id, resource); err != nil {
			log.Error("error applying resource update to deployment", "error", err.Error())
		}
	}
}

func (r *Resources) Get(id string) (*pb.Resource, bool) {
	return r.repo.Resources.Get(id)
}

func (r *Resources) Remove(ctx context.Context, id string) {
	r.repo.Resources.Remove(id)
	r.store.ReleaseTargets.Recompute(ctx)
}

func (r *Resources) Items() map[string]*pb.Resource {
	return r.repo.Resources.Items()
}

func (r *Resources) Has(id string) bool {
	return r.repo.Resources.Has(id)
}
