package store

import (
	"context"
	"workspace-engine/pkg/changeset"
	"workspace-engine/pkg/cmap"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/materialized"
	"workspace-engine/pkg/workspace/store/repository"
)

func NewSystems(store *Store) *Systems {
	return &Systems{
		repo:         store.repo,
		store:        store,
		deployments:  cmap.New[*materialized.MaterializedView[map[string]*oapi.Deployment]](),
		environments: cmap.New[*materialized.MaterializedView[map[string]*oapi.Environment]](),
	}
}

type Systems struct {
	repo  *repository.Repository
	store *Store

	deployments  cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*oapi.Deployment]]
	environments cmap.ConcurrentMap[string, *materialized.MaterializedView[map[string]*oapi.Environment]]
}

func (s *Systems) Upsert(ctx context.Context, system *oapi.System) error {
	s.repo.Systems.Set(system.Id, system)

	if _, ok := s.deployments.Get(system.Id); !ok {
		s.deployments.Set(system.Id,
			materialized.New(s.computeDeployments(system.Id)),
		)
		s.environments.Set(system.Id,
			materialized.New(s.computeEnvironments(system.Id)),
		)
	}

	return nil
}

func (s *Systems) Get(id string) (*oapi.System, bool) {
	return s.repo.Systems.Get(id)
}

func (s *Systems) Has(id string) bool {
	return s.repo.Systems.Has(id)
}

func (s *Systems) computeDeployments(systemId string) materialized.RecomputeFunc[map[string]*oapi.Deployment] {
	return func(ctx context.Context) (map[string]*oapi.Deployment, error) {
		deployments := make(map[string]*oapi.Deployment, s.repo.Deployments.Count())
		for deploymentItem := range s.repo.Deployments.IterBuffered() {
			if deploymentItem.Val.SystemId != systemId {
				continue
			}
			deployments[deploymentItem.Key] = deploymentItem.Val
		}
		return deployments, nil
	}
}

func (s *Systems) Deployments(systemId string) map[string]*oapi.Deployment {
	mv, ok := s.deployments.Get(systemId)
	if !ok {
		return map[string]*oapi.Deployment{}
	}
	_ = mv.WaitIfRunning()
	return mv.Get()
}

func (s *Systems) computeEnvironments(systemId string) materialized.RecomputeFunc[map[string]*oapi.Environment] {
	return func(ctx context.Context) (map[string]*oapi.Environment, error) {
		environments := make(map[string]*oapi.Environment, s.repo.Environments.Count())
		for environmentItem := range s.repo.Environments.IterBuffered() {
			if environmentItem.Val.SystemId != systemId {
				continue
			}
			environments[environmentItem.Key] = environmentItem.Val
		}
		return environments, nil
	}
}

func (s *Systems) Environments(systemId string) map[string]*oapi.Environment {
	mv, ok := s.environments.Get(systemId)
	if !ok {
		return map[string]*oapi.Environment{}
	}
	_ = mv.WaitIfRunning()
	return mv.Get()
}

func (s *Systems) Remove(ctx context.Context, id string) {
	system, ok := s.repo.Systems.Get(id)
	if !ok { return }

	deployments := s.Deployments(id)
	for key := range deployments {
		s.store.Deployments.Remove(ctx, key)
	}

	environments := s.Environments(id)
	for key := range environments {
		s.store.Environments.Remove(ctx, key)
	}

	s.repo.Systems.Remove(id)

	if cs, ok := changeset.FromContext[any](ctx); ok {
		cs.Record(changeset.ChangeTypeDelete, system)
	}
}

// ApplyDeploymentUpdate triggers a recompute of deployments for the affected systems
// when a deployment is updated or moved between systems.
func (s *Systems) ApplyDeploymentUpdate(
	ctx context.Context,
	previousSystemId string,
	deployment *oapi.Deployment,
) {
	// Recompute deployments for the previous system, if it exists
	if oldDeployments, exists := s.deployments.Get(previousSystemId); exists {
		_ = oldDeployments.StartRecompute(ctx)
	}

	deploymentHasMoved := previousSystemId != deployment.SystemId
	if deploymentHasMoved {
		if newDeployments, exists := s.deployments.Get(deployment.SystemId); exists {
			_ = newDeployments.StartRecompute(ctx)
		}
	}

}

// ApplyEnvironmentUpdate triggers a recompute of environments for the affected systems
// when a deployment is updated or moved between systems.
func (s *Systems) ApplyEnvironmentUpdate(
	ctx context.Context,
	previousSystemId string,
	environment *oapi.Environment,
) {
	// Recompute deployments for the previous system, if it exists
	if oldEnvironments, exists := s.environments.Get(previousSystemId); exists {
		_ = oldEnvironments.StartRecompute(ctx)
	}

	environmentHasMoved := previousSystemId != environment.SystemId
	if environmentHasMoved {
		if newEnvironments, exists := s.environments.Get(environment.SystemId); exists {
			_ = newEnvironments.StartRecompute(ctx)
		}
	}
}

func (s *Systems) Items() map[string]*oapi.System {
	return s.repo.Systems.Items()
}
