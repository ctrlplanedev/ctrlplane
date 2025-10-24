package store

import (
	"context"
	"sync"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
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

func (r *Resources) Upsert(ctx context.Context, resource *oapi.Resource) (*oapi.Resource, error) {
	ctx, span := tracer.Start(ctx, "Upsert", trace.WithAttributes(
		attribute.String("resource.id", resource.Id),
	))
	defer span.End()

	r.repo.Resources.Set(resource.Id, resource)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		ctx, span := tracer.Start(ctx, "RecomputeEnvironmentsResources")
		defer span.End()

		defer wg.Done()
		for item := range r.store.Environments.IterBuffered() {
			environment := item.Val
			if err := r.store.Environments.RecomputeResources(ctx, environment.Id); err != nil && !materialized.IsAlreadyStarted(err) {
				span.RecordError(err)
				span.SetStatus(codes.Error, "Failed to recompute resources for environment")
				log.Error("Failed to recompute resources for environment", "environmentId", environment.Id, "error", err)
			}
		}
	}()
	go func() {
		ctx, span := tracer.Start(ctx, "RecomputeDeploymentsResources")
		defer span.End()

		defer wg.Done()
		for item := range r.store.Deployments.IterBuffered() {
			deployment := item.Val
			if err := r.store.Deployments.RecomputeResources(ctx, deployment.Id); err != nil && !materialized.IsAlreadyStarted(err) {
				span.RecordError(err)
				span.SetStatus(codes.Error, "Failed to recompute resources for deployment")
				log.Error("Failed to recompute resources for deployment", "deploymentId", deployment.Id, "error", err)
			}
		}
	}()
	wg.Wait()

	if err := r.store.ReleaseTargets.Recompute(ctx); err != nil && !materialized.IsAlreadyStarted(err) {
		span.RecordError(err)
		log.Error("Failed to recompute release targets", "error", err)
	}

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeUpsert, resource)
	}

	return resource, nil
}

func (r *Resources) Get(id string) (*oapi.Resource, bool) {
	return r.repo.Resources.Get(id)
}

func (r *Resources) Remove(ctx context.Context, id string) {
	ctx, span := tracer.Start(ctx, "Remove", trace.WithAttributes(
		attribute.String("resource.id", id),
	))
	defer span.End()

	resource, ok := r.repo.Resources.Get(id)
	if !ok || resource == nil {
		return
	}

	r.repo.Resources.Remove(id)

	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		for item := range r.store.Environments.IterBuffered() {
			environment := item.Val
			if err := r.store.Environments.RecomputeResources(ctx, environment.Id); err != nil {
				log.Error("Failed to recompute resources for environment", "environmentId", environment.Id, "error", err)
			}
		}
	}()
	go func() {
		defer wg.Done()
		for item := range r.store.Deployments.IterBuffered() {
			deployment := item.Val
			if err := r.store.Deployments.RecomputeResources(ctx, deployment.Id); err != nil {
				log.Error("Failed to recompute resources for deployment", "deploymentId", deployment.Id, "error", err)
			}
		}
	}()
	wg.Wait()

	if err := r.store.ReleaseTargets.Recompute(ctx); err != nil && !materialized.IsAlreadyStarted(err) {
		span.RecordError(err)
		log.Error("Failed to recompute release targets", "error", err)
	}

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, resource)
	}
}

func (r *Resources) Items() map[string]*oapi.Resource {
	return r.repo.Resources.Items()
}

func (r *Resources) Has(id string) bool {
	return r.repo.Resources.Has(id)
}

func (r *Resources) Variables(resourceId string) map[string]*oapi.ResourceVariable {
	variables := make(map[string]*oapi.ResourceVariable, 25)
	for item := range r.repo.ResourceVariables.IterBuffered() {
		if item.Val.ResourceId != resourceId {
			continue
		}
		variables[item.Val.Key] = item.Val
	}
	return variables
}
