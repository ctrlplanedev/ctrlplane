package store

import (
	"context"
	"workspace-engine/pkg/oapi"
	"workspace-engine/pkg/workspace/store/repository"

	"github.com/charmbracelet/log"
)

func NewSystems(store *Store) *Systems {
	return &Systems{
		repo:  store.repo.Systems(),
		store: store,
	}
}

type Systems struct {
	repo  repository.SystemRepo
	store *Store
}

// SetRepo replaces the underlying SystemRepo implementation.
func (s *Systems) SetRepo(repo repository.SystemRepo) {
	s.repo = repo
}

func (s *Systems) Get(id string) (*oapi.System, bool) {
	return s.repo.Get(id)
}

func (s *Systems) Upsert(ctx context.Context, system *oapi.System) error {
	if err := s.repo.Set(system); err != nil {
		log.Error("Failed to upsert system", "error", err)
	}
	s.store.changeset.RecordUpsert(system)

	return nil
}

func (s *Systems) Remove(ctx context.Context, id string) {
	system, ok := s.repo.Get(id)
	if !ok || system == nil {
		return
	}

	s.repo.Remove(id)
	s.store.changeset.RecordDelete(system)
}

func (s *Systems) Items() map[string]*oapi.System {
	return s.repo.Items()
}

func (s *Systems) Deployments(systemId string) map[string]*oapi.Deployment {
	ids := s.store.SystemDeployments.GetDeploymentIDsForSystem(systemId)
	result := make(map[string]*oapi.Deployment, len(ids))
	for _, id := range ids {
		if d, ok := s.store.Deployments.Get(id); ok {
			result[id] = d
		}
	}
	return result
}

func (s *Systems) Environments(systemId string) map[string]*oapi.Environment {
	ids := s.store.SystemEnvironments.GetEnvironmentIDsForSystem(systemId)
	result := make(map[string]*oapi.Environment, len(ids))
	for _, id := range ids {
		if e, ok := s.store.Environments.Get(id); ok {
			result[id] = e
		}
	}
	return result
}
